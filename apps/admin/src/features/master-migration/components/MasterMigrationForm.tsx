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
import type { CsvFileKey, CsvParseError } from '@/features/master-import/ports';
import type {
  MigrationBlocker,
  MigrationBlockerCode,
  MigrationResult,
  Unmatched,
  UnmatchedReason,
} from '../domain/migrationPlan';
import type { MigrationSummary, MigrationTableSummary } from '../usecases/planMigration';

const FILE_LABELS: Record<CsvFileKey, string> = {
  company: 'company（事業者）',
  line: 'line（路線）',
  station: 'station（駅）',
  join: 'join（隣接駅）',
};

const FILE_KEYS = Object.keys(FILE_LABELS) as CsvFileKey[];

const BLOCKER_LABELS: Record<MigrationBlockerCode, string> = {
  duplicate_ekidata_code:
    '複数の既存行が同じコードに突合した。ekidata コードは一意制約付きであり、' +
    'このまま適用するとトランザクション全体が失敗する。手動対応表で振り分けること',
  code_taken_by_other_row:
    '割り当てようとしたコードを、既に別の行が持っている。' +
    '突合済みの行を含めて対応を見直すこと',
  connection_has_input:
    '難易度またはメモが入力済みの乗換接続がある。' +
    '「全546件が未入力なので作り直してよい」という前提が崩れているため、' +
    '手作業で退避してから再実行すること',
};

const REASON_LABELS: Record<UnmatchedReason, string> = {
  operator_not_in_table: '対応表に無い事業者',
  company_not_in_csv: '対応表のコードがCSVに無い',
  operator_unresolved: '事業者が未突合',
  line_unresolved: '路線が未突合',
  line_unknown: '所属路線が無い',
  no_candidate: '候補なし',
  no_ekidata_counterpart: 'ekidata に対応行が無い（確認済み）',
  ambiguous: '候補が複数',
};

type PlanResponse = {
  mode: 'plan';
  summary: MigrationSummary;
  unmatched: { operators: Unmatched[]; lines: Unmatched[]; stations: Unmatched[] };
  blockers: MigrationBlocker[];
  planToken: string;
};

type ErrorResponse = { error: string; missing?: CsvFileKey[]; details?: CsvParseError[] };

type Files = Partial<Record<CsvFileKey, File>>;

export function MasterMigrationForm() {
  const [files, setFiles] = useState<Files>({});
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [applied, setApplied] = useState<MigrationResult | null>(null);
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
      const response = await fetch('/api/master-migration', { method: 'POST', body });
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(describeError(payload));
        return;
      }
      if (mode === 'plan') {
        setApplied(null);
        setPlan(payload as PlanResponse);
      } else {
        setApplied((payload as { applied: MigrationResult }).applied);
        setPlan(null);
      }
    } catch {
      setError('通信に失敗した');
    } finally {
      setPending(null);
    }
  }

  function chooseFile(key: CsvFileKey, file: File | null) {
    // CSV が差し替わった時点で、提示済みの試算は別の入力に対するものになる
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
          突合を試算
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
          <Title order={3}>試算</Title>
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

          <UnmatchedSection title="未突合の事業者" rows={plan.unmatched.operators} />
          <UnmatchedSection title="未突合の路線" rows={plan.unmatched.lines} />
          <UnmatchedSection title="未突合の駅" rows={plan.unmatched.stations} />

          <Group>
            <Button
              color="red"
              onClick={() => send('apply')}
              disabled={pending !== null || plan.blockers.length > 0}
            >
              承認して適用
            </Button>
            <Text size="sm" c="dimmed">
              未突合の行は削除されず、コードが空のまま残る
            </Text>
          </Group>
        </Stack>
      )}

      {applied && (
        <Alert color="green" title="適用した">
          <List spacing="xs">
            <ListItem>事業者: {applied.operators.assigned} 件にコードを設定</ListItem>
            <ListItem>路線: {applied.lines.assigned} 件にコードを設定</ListItem>
            <ListItem>駅: {applied.stations.assigned} 件にコードを設定</ListItem>
            <ListItem>
              乗換接続: {applied.stationConnections.deleted} 件を削除（次に「マスタ取込」を
              実行すると駅データ.jp の乗換グループから作り直される）
            </ListItem>
          </List>
        </Alert>
      )}
    </Stack>
  );
}

function SummaryTable({ summary }: { summary: MigrationSummary }) {
  const rows: Array<[string, MigrationTableSummary]> = [
    ['事業者', summary.operators],
    ['路線', summary.lines],
    ['駅', summary.stations],
  ];

  return (
    <Stack gap="xs">
      <Table striped withTableBorder>
        <TableThead>
          <TableTr>
            <TableTh>テーブル</TableTh>
            <TableTh>全行</TableTh>
            <TableTh>今回設定</TableTh>
            <TableTh>設定済み</TableTh>
            <TableTh>未突合</TableTh>
            <TableTh>内訳（手動/名前/全駅包含）</TableTh>
          </TableTr>
        </TableThead>
        <TableTbody>
          {rows.map(([label, table]) => (
            <TableTr key={label}>
              <TableTd>{label}</TableTd>
              <TableTd>{table.total}</TableTd>
              <TableTd>{table.assigned}</TableTd>
              <TableTd>{table.alreadySet}</TableTd>
              <TableTd>{table.unmatched}</TableTd>
              <TableTd>
                {table.byMethod.manual} / {table.byMethod.name} / {table.byMethod.stationContainment}
              </TableTd>
            </TableTr>
          ))}
        </TableTbody>
      </Table>
      <Text size="sm" c="dimmed">
        乗換接続 {summary.connections.total} 件のうち {summary.connections.replaceable} 件が
        作り直しの対象（入力済み {summary.connections.withInput} 件）。
      </Text>
    </Stack>
  );
}

function UnmatchedSection({ title, rows }: { title: string; rows: Unmatched[] }) {
  if (rows.length === 0) return null;

  return (
    <Stack gap="xs">
      <Title order={4}>
        {title}（{rows.length}件）
      </Title>
      <Text size="xs" c="dimmed">
        候補は名前が近い順に出している。CSV で確認し、manualMappings.ts に書き足すと次回から解決する
      </Text>
      <Table striped withTableBorder>
        <TableThead>
          <TableTr>
            <TableTh>名前</TableTh>
            <TableTh>理由</TableTh>
            <TableTh>手がかり</TableTh>
            <TableTh>候補</TableTh>
          </TableTr>
        </TableThead>
        <TableTbody>
          {rows.map((row) => (
            <TableTr key={row.id}>
              <TableTd>{row.name}</TableTd>
              <TableTd>{REASON_LABELS[row.reason]}</TableTd>
              <TableTd>{row.context}</TableTd>
              <TableTd>
                {row.candidates.map((candidate) => (
                  <Code key={candidate.code} mr={4}>
                    {candidate.code} {candidate.name}
                  </Code>
                ))}
              </TableTd>
            </TableTr>
          ))}
        </TableTbody>
      </Table>
    </Stack>
  );
}

function Samples({ samples }: { samples: string[] }) {
  if (samples.length === 0) return null;
  return (
    <Text size="xs" c="dimmed" component="div">
      例:{' '}
      {samples.map((sample) => (
        <Code key={sample} mr={4}>
          {sample}
        </Code>
      ))}
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
