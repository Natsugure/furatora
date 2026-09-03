'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Code,
  FileInput,
  Group,
  List,
  ListItem,
  Loader,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  Title,
} from '@mantine/core';
import type {
  ImportBlocker,
  ImportBlockerCode,
  ImportSummary,
  ImportWarning,
  ImportWarningCode,
  ApplyResult,
} from '../domain/importedRecords';
import type { CsvFileKey, CsvParseError } from '../ports';

const FILE_LABELS: Record<CsvFileKey, string> = {
  company: 'company（事業者）',
  line: 'line（路線）',
  station: 'station（駅）',
  join: 'join（隣接駅）',
};

const FILE_KEYS = Object.keys(FILE_LABELS) as CsvFileKey[];

const WARNING_LABELS: Record<ImportWarningCode, string> = {
  line_with_unknown_company: '事業者が現役でない路線（取り込まない）',
  station_with_unknown_line: '路線が現役でない駅（取り込まない）',
  adjacency_unknown_line: '路線が現役でない隣接（取り込まない）',
  adjacency_endpoint_missing: '端点が現役駅でない隣接（取り込まない）',
  dangling_station_group: '代表駅が現役に無い乗換グループ（所属駅から代表値を決めた）',
  not_yet_opened_line: '未開業の路線（取り込まない。廃止扱いにもしない）',
  not_yet_opened_station: '未開業の駅（取り込まない。廃止扱いにもしない）',
};

const BLOCKER_LABELS: Record<ImportBlockerCode, string> = {
  operator_name_conflict:
    '事業者名が既存の別の事業者と重複している。' +
    'このまま適用すると operators.name の一意制約でトランザクション全体が失敗する。' +
    '先に移行スクリプトで ekidata コードを突合すること',
};

type PlanResponse = {
  mode: 'plan';
  summary: ImportSummary;
  warnings: ImportWarning[];
  blockers: ImportBlocker[];
  planToken: string;
};

type ErrorResponse = { error: string; missing?: CsvFileKey[]; details?: CsvParseError[] };

type Files = Partial<Record<CsvFileKey, File>>;

export function MasterImportForm() {
  const [files, setFiles] = useState<Files>({});
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [pending, setPending] = useState<'plan' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allSelected = FILE_KEYS.every((key) => files[key]);

  async function send(mode: 'plan' | 'apply') {
    setPending(mode);
    setError(null);

    const body = new FormData();
    body.set('mode', mode);
    for (const key of FILE_KEYS) {
      const file = files[key];
      if (file) body.set(key, file);
    }
    if (mode === 'apply' && plan) body.set('planToken', plan.planToken);

    try {
      const response = await fetch('/api/master-import', { method: 'POST', body });
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(describeError(payload));
        return;
      }
      if (mode === 'plan') {
        setApplied(null);
        setPlan(payload as PlanResponse);
      } else {
        setApplied((payload as { applied: ApplyResult }).applied);
        setPlan(null);
      }
    } catch {
      setError('通信に失敗した');
    } finally {
      setPending(null);
    }
  }

  function chooseFile(key: CsvFileKey, file: File | null) {
    // CSV が差し替わった時点で、提示済みの差分は別の入力に対するものになる
    setPlan(null);
    setApplied(null);
    setFiles((current) => ({ ...current, [key]: file ?? undefined }));
  }

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        {FILE_KEYS.map((key) => (
          <FileInput
            key={key}
            label={FILE_LABELS[key]}
            placeholder="CSVを選択"
            accept=".csv,text/csv"
            value={files[key] ?? null}
            onChange={(file) => chooseFile(key, file)}
            clearable
          />
        ))}
      </Stack>

      <Group>
        <Button onClick={() => send('plan')} disabled={!allSelected || pending !== null}>
          差分を確認
        </Button>
        {pending && <Loader size="sm" />}
      </Group>

      {error && (
        <Alert color="red" title="エラー">
          {error}
        </Alert>
      )}

      {plan && (
        <Stack gap="md">
          <Title order={3}>差分</Title>
          <SummaryTable summary={plan.summary} />

          {plan.blockers.length > 0 && (
            <Alert color="red" title="このままでは適用できない">
              <List spacing="xs">
                {plan.blockers.map((blocker) => (
                  <ListItem key={blocker.code}>
                    {BLOCKER_LABELS[blocker.code]}（{blocker.count}件）
                    <Samples samples={blocker.samples} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {plan.warnings.length > 0 && (
            <Alert color="yellow" title="警告">
              <List spacing="xs">
                {plan.warnings.map((warning) => (
                  <ListItem key={warning.code}>
                    {WARNING_LABELS[warning.code]}（{warning.count}件）
                    <Samples samples={warning.samples} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          <Group>
            <Button
              color="red"
              onClick={() => send('apply')}
              disabled={pending !== null || plan.blockers.length > 0}
            >
              承認して適用
            </Button>
            <Text size="sm" c="dimmed">
              適用は単一トランザクションで行われ、10秒前後かかる
            </Text>
          </Group>
        </Stack>
      )}

      {applied && (
        <Alert color="green" title="適用した">
          <List spacing="xs">
            <ListItem>
              事業者: 新規 {applied.operators.created} / 更新 {applied.operators.updated}
            </ListItem>
            <ListItem>
              路線: 新規 {applied.lines.created} / 更新 {applied.lines.updated} / 廃止{' '}
              {applied.lines.abolished}
            </ListItem>
            <ListItem>
              乗換単位の駅: 新規 {applied.stationGroups.created} / 更新{' '}
              {applied.stationGroups.updated}
            </ListItem>
            <ListItem>
              駅: 新規 {applied.stations.created} / 更新 {applied.stations.updated} / 廃止{' '}
              {applied.stations.abolished}
            </ListItem>
            <ListItem>駅と路線の関連: 新規 {applied.stationLines.created}</ListItem>
            <ListItem>隣接: 新規 {applied.stationAdjacencies.created}</ListItem>
            <ListItem>乗換接続: 新規 {applied.stationConnections.created}</ListItem>
          </List>
        </Alert>
      )}
    </Stack>
  );
}

function SummaryTable({ summary }: { summary: ImportSummary }) {
  const rows: Array<[string, number, number, number, number | null]> = [
    [
      '事業者',
      summary.operators.created,
      summary.operators.updated,
      summary.operators.unchanged,
      null,
    ],
    ['路線', summary.lines.created, summary.lines.updated, summary.lines.unchanged, summary.lines.abolished],
    [
      '乗換単位の駅',
      summary.stationGroups.created,
      summary.stationGroups.updated,
      summary.stationGroups.unchanged,
      null,
    ],
    [
      '駅',
      summary.stations.created,
      summary.stations.updated,
      summary.stations.unchanged,
      summary.stations.abolished,
    ],
    ['駅と路線の関連', summary.stationLines.created, 0, 0, null],
    ['隣接', summary.stationAdjacencies.created, 0, 0, null],
  ];

  return (
    <Stack gap="xs">
      <Table striped withTableBorder>
        <TableThead>
          <TableTr>
            <TableTh>テーブル</TableTh>
            <TableTh>新規</TableTh>
            <TableTh>更新</TableTh>
            <TableTh>変更なし</TableTh>
            <TableTh>廃止</TableTh>
          </TableTr>
        </TableThead>
        <TableTbody>
          {rows.map(([label, created, updated, unchanged, abolished]) => (
            <TableTr key={label}>
              <TableTd>{label}</TableTd>
              <TableTd>{created}</TableTd>
              <TableTd>{updated}</TableTd>
              <TableTd>{unchanged}</TableTd>
              <TableTd>{abolished ?? '—'}</TableTd>
            </TableTr>
          ))}
        </TableTbody>
      </Table>
      <Text size="sm" c="dimmed">
        乗換接続は最大 {summary.stationConnections.upperBound} 件。
        実際の挿入数は既存行との重複を除いた後にしか確定しないため、適用後に報告する
      </Text>
    </Stack>
  );
}

function Samples({ samples }: { samples: string[] }) {
  if (samples.length === 0) return null;
  return (
    <Text size="xs" c="dimmed" component="div">
      例: {samples.map((sample) => <Code key={sample} mr={4}>{sample}</Code>)}
    </Text>
  );
}

function describeError(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '不明なエラー';
  const body = payload as ErrorResponse;

  if (body.missing?.length) {
    return `${body.error}: ${body.missing.map((key) => FILE_LABELS[key]).join(' / ')}`;
  }
  if (body.details?.length) {
    const lines = body.details.map((detail) =>
      detail.kind === 'missing_columns'
        ? `${FILE_LABELS[detail.file]} に列がない: ${detail.columns.join(', ')}`
        : `${FILE_LABELS[detail.file]}: ${detail.message}`,
    );
    return `${body.error} — ${lines.join(' / ')}`;
  }
  return body.error ?? '不明なエラー';
}
