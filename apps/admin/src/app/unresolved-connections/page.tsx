'use client';

import { useEffect, useState } from 'react';
import {
  Badge, Button, Card, Collapse, Group, Loader, NativeSelect,
  SegmentedControl, Stack, Text, TextInput, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { suggestRailwaysFromOdptIds, suggestStationsFromOdptIds } from '@/actions/gemini';
import type { RailwaySuggestion, StationSuggestion } from '@/actions/gemini';
import { RailwayBulkSuggestModal } from '@/components/RailwayBulkSuggestModal';
import { StationBulkSuggestModal } from '@/components/StationBulkSuggestModal';

type Operator = { id: string; name: string; odptOperatorId: string | null };

type UnresolvedRailway = {
  odptRailwayId: string;
  referenceCount: number;
  referencingStationNames: string[];
  operatorKey: string;
  suggestedName: string;
};

type UnresolvedStation = {
  odptStationId: string;
  odptRailwayId: string | null;
  referenceCount: number;
  referencingStationNames: string[];
  operatorKey: string;
  suggestedLineName: string;
  suggestedName: string;
};

type AllStation = { id: string; name: string; code: string | null; operatorId: string };
type AllLine = { id: string; name: string; odptRailwayId: string | null };

function OperatorSection({
  operators,
  onCreated,
}: {
  operators: Operator[];
  onCreated: (op: Operator) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [odptOperatorId, setOdptOperatorId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/operators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), odptOperatorId: odptOperatorId || null }),
    });
    if (res.ok) {
      const op = await res.json();
      onCreated(op);
      setName('');
      setOdptOperatorId('');
      setOpen(false);
    } else {
      alert('作成に失敗しました');
    }
    setSubmitting(false);
  }

  return (
    <Card withBorder padding="md" bg="gray.0">
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          登録済み事業者 ({operators.length}件)：
          {operators.map((o) => o.name).join('、')}
        </Text>
        <Button variant="subtle" size="compact-sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'キャンセル' : '+ 事業者を追加'}
        </Button>
      </Group>
      <Collapse in={open}>
        <Group gap="sm" mt="sm" align="flex-end">
          <TextInput
            label="名称 *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: JR東日本"
            size="sm"
            w={160}
          />
          <TextInput
            label="ODPT ID"
            value={odptOperatorId}
            onChange={(e) => setOdptOperatorId(e.target.value)}
            placeholder="odpt.Operator:JR-East"
            size="sm"
            w={224}
          />
          <Button size="sm" onClick={handleCreate} disabled={submitting || !name.trim()}>
            作成
          </Button>
        </Group>
      </Collapse>
    </Card>
  );
}

function RailwayRow({
  railway,
  operators,
  isExpanded,
  onToggle,
  onResolved,
}: {
  railway: UnresolvedRailway;
  operators: Operator[];
  isExpanded: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const [name, setName] = useState(railway.suggestedName);
  const [nameEn, setNameEn] = useState(railway.suggestedName);
  const [operatorId, setOperatorId] = useState(() => {
    const match = operators.find((o) =>
      o.odptOperatorId?.toLowerCase().includes(railway.operatorKey.toLowerCase())
    );
    return match?.id ?? '';
  });
  const [lineCode, setLineCode] = useState('');
  const [color, setColor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !operatorId) return;
    setSubmitting(true);
    const res = await fetch('/api/unresolved-connections/railways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ odptRailwayId: railway.odptRailwayId, name, nameEn, operatorId, lineCode, color }),
    });
    if (res.ok) {
      onResolved();
    } else {
      alert('作成に失敗しました');
    }
    setSubmitting(false);
  }

  return (
    <div style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
      <Group px="md" py="sm" gap="md">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" ff="monospace" c="dimmed" truncate>{railway.odptRailwayId}</Text>
          <Text size="xs" c="dimmed" mt={2}>
            {railway.referencingStationNames.slice(0, 5).join('・')}
            {railway.referencingStationNames.length > 5 && ` 他${railway.referencingStationNames.length - 5}駅`}
          </Text>
        </div>
        <Badge size="sm" variant="light">{railway.referenceCount}件</Badge>
        <Button variant="subtle" size="compact-sm" onClick={onToggle}>
          {isExpanded ? '閉じる' : '解決'}
        </Button>
      </Group>

      <Collapse in={isExpanded}>
        <Group gap="sm" px="md" pb="md" bg="blue.0" pt="sm" align="flex-end" wrap="wrap">
          <TextInput label="路線名 *" value={name} onChange={(e) => setName(e.target.value)} size="sm" w={128} />
          <TextInput label="英語名" value={nameEn} onChange={(e) => setNameEn(e.target.value)} size="sm" w={128} />
          <NativeSelect
            label="事業者 *"
            data={[{ value: '', label: '選択' }, ...operators.map((o) => ({ value: o.id, label: o.name }))]}
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            size="sm"
          />
          <TextInput label="路線コード" value={lineCode} onChange={(e) => setLineCode(e.target.value)} placeholder="例: JC" size="sm" w={80} />
          <TextInput label="カラー" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#F15A22" size="sm" w={96} />
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !name.trim() || !operatorId} loading={submitting}>
            路線を作成
          </Button>
        </Group>
      </Collapse>
    </div>
  );
}

function StationRow({
  station,
  operators,
  allStations,
  allLines,
  isExpanded,
  onToggle,
  onResolved,
}: {
  station: UnresolvedStation;
  operators: Operator[];
  allStations: AllStation[];
  allLines: AllLine[];
  isExpanded: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const [mode, setMode] = useState<string>('create');
  const [name, setName] = useState(station.suggestedName);
  const [nameEn, setNameEn] = useState(station.suggestedName);
  const [code, setCode] = useState('');
  const [operatorId, setOperatorId] = useState(() => {
    const match = operators.find((o) =>
      o.odptOperatorId?.toLowerCase().includes(station.operatorKey.toLowerCase())
    );
    return match?.id ?? '';
  });
  const [lineId, setLineId] = useState(() => {
    if (!station.odptRailwayId) return '';
    return allLines.find((l) => l.odptRailwayId === station.odptRailwayId)?.id ?? '';
  });
  const [linkStationId, setLinkStationId] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredStations = stationFilter
    ? allStations.filter(
        (s) =>
          s.name.includes(stationFilter) ||
          s.code?.toLowerCase().includes(stationFilter.toLowerCase())
      )
    : allStations;

  async function handleSubmit() {
    setSubmitting(true);
    const body =
      mode === 'create'
        ? { action: 'create', odptStationId: station.odptStationId, name, nameEn, code, operatorId, lineId: lineId || undefined }
        : { action: 'link', odptStationId: station.odptStationId, stationId: linkStationId };

    const res = await fetch('/api/unresolved-connections/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      onResolved();
    } else {
      alert('保存に失敗しました');
    }
    setSubmitting(false);
  }

  const canSubmit =
    mode === 'create' ? name.trim() !== '' && operatorId !== '' : linkStationId !== '';

  return (
    <div style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
      <Group px="md" py="sm" gap="md">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" ff="monospace" c="dimmed" truncate>{station.odptStationId}</Text>
          <Text size="xs" c="dimmed" mt={2}>
            {station.referencingStationNames.slice(0, 5).join('・')}
            {station.referencingStationNames.length > 5 &&
              ` 他${station.referencingStationNames.length - 5}駅`}
          </Text>
        </div>
        <Badge size="sm" variant="light">{station.referenceCount}件</Badge>
        <Button variant="subtle" size="compact-sm" onClick={onToggle}>
          {isExpanded ? '閉じる' : '解決'}
        </Button>
      </Group>

      <Collapse in={isExpanded}>
        <Stack gap="sm" px="md" pb="md" bg="blue.0" pt="sm">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            data={[
              { value: 'create', label: '新規作成' },
              { value: 'link', label: '既存駅に紐付け' },
            ]}
            size="sm"
          />

          {mode === 'create' ? (
            <Group gap="sm" align="flex-end" wrap="wrap">
              <TextInput label="駅名 *" value={name} onChange={(e) => setName(e.target.value)} size="sm" w={112} />
              <TextInput label="英語名" value={nameEn} onChange={(e) => setNameEn(e.target.value)} size="sm" w={112} />
              <TextInput label="駅コード" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例: JC05" size="sm" w={80} />
              <NativeSelect
                label="事業者 *"
                data={[{ value: '', label: '選択' }, ...operators.map((o) => ({ value: o.id, label: o.name }))]}
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                size="sm"
              />
              <NativeSelect
                label="路線"
                data={[{ value: '', label: '未選択' }, ...allLines.map((l) => ({ value: l.id, label: l.name }))]}
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                size="sm"
              />
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !canSubmit} loading={submitting}>
                駅を作成
              </Button>
            </Group>
          ) : (
            <Group gap="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="駅を検索"
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                placeholder="駅名・コードで絞り込み"
                size="sm"
                w={176}
              />
              <NativeSelect
                label="紐付け先 *"
                data={[
                  { value: '', label: '選択' },
                  ...filteredStations.slice(0, 100).map((s) => ({
                    value: s.id,
                    label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
                  })),
                  ...(filteredStations.length > 100
                    ? [{ value: '__overflow', label: `... 絞り込んでください (${filteredStations.length}件)`, disabled: true }]
                    : []),
                ]}
                value={linkStationId}
                onChange={(e) => setLinkStationId(e.target.value)}
                size="sm"
                w={224}
              />
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !canSubmit} loading={submitting}>
                紐付け
              </Button>
            </Group>
          )}
        </Stack>
      </Collapse>
    </div>
  );
}

export default function UnresolvedConnectionsPage() {
  const [railways, setRailways] = useState<UnresolvedRailway[]>([]);
  const [stations, setStations] = useState<UnresolvedStation[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [allStations, setAllStations] = useState<AllStation[]>([]);
  const [allLines, setAllLines] = useState<AllLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRailwayId, setExpandedRailwayId] = useState<string | null>(null);
  const [expandedStationId, setExpandedStationId] = useState<string | null>(null);

  // AI提案モーダル
  const [railwayModalOpen, setRailwayModalOpen] = useState(false);
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [pendingRailwaySuggestions, setPendingRailwaySuggestions] = useState<RailwaySuggestion[]>([]);
  const [pendingStationSuggestions, setPendingStationSuggestions] = useState<StationSuggestion[]>([]);
  const [railwayModalKey, setRailwayModalKey] = useState(0);
  const [stationModalKey, setStationModalKey] = useState(0);
  const [aiRailwayLoading, setAiRailwayLoading] = useState(false);
  const [aiStationLoading, setAiStationLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/unresolved-connections').then((r) => r.json()),
      fetch('/api/operators').then((r) => r.json()),
      fetch('/api/stations').then((r) => r.json()),
      fetch('/api/lines').then((r) => r.json()),
    ]).then(([connectionsData, operatorsData, stationsData, linesData]) => {
      setRailways(connectionsData.railways);
      setStations(connectionsData.stations);
      setOperators(operatorsData);
      setAllStations(stationsData);
      setAllLines(linesData);
      setLoading(false);
    });
  }, []);

  async function handleBulkRailwaySuggest() {
    setAiRailwayLoading(true);
    try {
      const ids = railways.map((r) => r.odptRailwayId);
      const results = await suggestRailwaysFromOdptIds(ids);
      setPendingRailwaySuggestions(results);
      setRailwayModalKey((k) => k + 1);
      setRailwayModalOpen(true);
    } catch (e) {
      notifications.show({
        title: 'AI提案エラー',
        message: (e as Error).message,
        color: 'red',
        autoClose: 6000,
      });
    }
    setAiRailwayLoading(false);
  }

  async function handleBulkStationSuggest() {
    setAiStationLoading(true);
    try {
      const ids = stations.map((s) => s.odptStationId);
      const results = await suggestStationsFromOdptIds(ids);
      setPendingStationSuggestions(results);
      setStationModalKey((k) => k + 1);
      setStationModalOpen(true);
    } catch (e) {
      notifications.show({
        title: 'AI提案エラー',
        message: (e as Error).message,
        color: 'red',
        autoClose: 6000,
      });
    }
    setAiStationLoading(false);
  }

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack gap="xl" maw="56rem">
      <div>
        <Title order={1} mb="xs">未解決の乗換接続</Title>
        <Text size="sm" c="dimmed">
          stationConnectionsテーブル内で、DBレコードに紐付けられていない路線・駅を登録します。
        </Text>
      </div>

      <OperatorSection
        operators={operators}
        onCreated={(op) => setOperators((prev) => [...prev, op])}
      />

      <section>
        <Group justify="space-between" mb="sm">
          <Title order={3}>
            未解決の路線
            <Text span size="sm" c="dimmed" fw={400} ml="xs">({railways.length}件)</Text>
          </Title>
          {railways.length > 0 && (
            <Button
              variant="light"
              color="violet"
              size="sm"
              loading={aiRailwayLoading}
              onClick={handleBulkRailwaySuggest}
            >
              一括AI提案
            </Button>
          )}
        </Group>
        {railways.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">未解決の路線はありません</Text>
        ) : (
          <Card withBorder padding={0}>
            {railways.map((railway) => (
              <RailwayRow
                key={railway.odptRailwayId}
                railway={railway}
                operators={operators}
                isExpanded={expandedRailwayId === railway.odptRailwayId}
                onToggle={() =>
                  setExpandedRailwayId(
                    expandedRailwayId === railway.odptRailwayId ? null : railway.odptRailwayId
                  )
                }
                onResolved={() => {
                  setRailways((prev) => prev.filter((r) => r.odptRailwayId !== railway.odptRailwayId));
                  setExpandedRailwayId(null);
                }}
              />
            ))}
          </Card>
        )}
      </section>

      <section>
        <Group justify="space-between" mb="sm">
          <Title order={3}>
            未解決の駅
            <Text span size="sm" c="dimmed" fw={400} ml="xs">({stations.length}件)</Text>
          </Title>
          {stations.length > 0 && (
            <Button
              variant="light"
              color="violet"
              size="sm"
              loading={aiStationLoading}
              onClick={handleBulkStationSuggest}
            >
              一括AI提案
            </Button>
          )}
        </Group>
        {stations.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">未解決の駅はありません</Text>
        ) : (
          <Card withBorder padding={0}>
            {stations.map((station) => (
              <StationRow
                key={station.odptStationId}
                station={station}
                operators={operators}
                allStations={allStations}
                allLines={allLines}
                isExpanded={expandedStationId === station.odptStationId}
                onToggle={() =>
                  setExpandedStationId(
                    expandedStationId === station.odptStationId ? null : station.odptStationId
                  )
                }
                onResolved={() => {
                  setStations((prev) =>
                    prev.filter((s) => s.odptStationId !== station.odptStationId)
                  );
                  setExpandedStationId(null);
                }}
              />
            ))}
          </Card>
        )}
      </section>

      <RailwayBulkSuggestModal
        key={`railway-${railwayModalKey}`}
        opened={railwayModalOpen}
        onClose={() => setRailwayModalOpen(false)}
        railways={railways}
        suggestions={pendingRailwaySuggestions}
        operators={operators}
        onResolved={(resolvedIds) => {
          setRailways((prev) => prev.filter((r) => !resolvedIds.includes(r.odptRailwayId)));
          setRailwayModalOpen(false);
        }}
      />

      <StationBulkSuggestModal
        key={`station-${stationModalKey}`}
        opened={stationModalOpen}
        onClose={() => setStationModalOpen(false)}
        stations={stations}
        suggestions={pendingStationSuggestions}
        operators={operators}
        lines={allLines}
        onResolved={(resolvedIds) => {
          setStations((prev) => prev.filter((s) => !resolvedIds.includes(s.odptStationId)));
          setStationModalOpen(false);
        }}
      />
    </Stack>
  );
}
