'use client';

import { useState } from 'react';
import {
  Button, Checkbox, Group, Modal, NativeSelect,
  ScrollArea, Stack, Text, TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { StationSuggestion } from '@/actions/gemini';

type Operator = { id: string; name: string; odptOperatorId: string | null };
type Line = { id: string; name: string; odptRailwayId: string | null };

type BulkStation = {
  odptStationId: string;
  odptRailwayId: string | null;
  suggestedName: string;
  operatorKey: string;
};

type RowState = {
  odptStationId: string;
  jaName: string;
  nameEn: string;
  stationCode: string;
  operatorId: string;
  lineId: string;
  checked: boolean;
};

export function StationBulkSuggestModal({
  opened,
  onClose,
  stations,
  suggestions,
  operators,
  lines,
  onResolved,
}: {
  opened: boolean;
  onClose: () => void;
  stations: BulkStation[];
  suggestions: StationSuggestion[];
  operators: Operator[];
  lines: Line[];
  onResolved: (resolvedIds: string[]) => void;
}) {
  const [rows, setRows] = useState<RowState[]>(() =>
    stations.map((station, i) => ({
      odptStationId: station.odptStationId,
      jaName: suggestions[i]?.jaName || station.suggestedName,
      nameEn: suggestions[i]?.nameEn || '',
      stationCode: suggestions[i]?.stationCode || '',
      operatorId:
        operators.find((o) =>
          o.odptOperatorId?.toLowerCase().includes(station.operatorKey.toLowerCase())
        )?.id ?? '',
      lineId: station.odptRailwayId
        ? (lines.find((l) => l.odptRailwayId === station.odptRailwayId)?.id ?? '')
        : '',
      checked: true,
    }))
  );
  const [submitting, setSubmitting] = useState(false);

  const allChecked = rows.length > 0 && rows.every((r) => r.checked);
  const someChecked = rows.some((r) => r.checked);
  const checkedCount = rows.filter((r) => r.checked).length;
  const hasInvalidCheckedRow = rows.some((r) => r.checked && (!r.jaName.trim() || !r.operatorId || !r.lineId));

  function updateRow(index: number, updates: Partial<RowState>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  }

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.currentTarget.checked;
    setRows((prev) => prev.map((row) => ({ ...row, checked: next })));
  }

  async function handleBulkRegister() {
    const checkedRows = rows.filter((r) => r.checked);
    const invalidRows = checkedRows.filter((r) => !r.jaName.trim() || !r.operatorId || !r.lineId);
    if (invalidRows.length > 0) {
      notifications.show({
        title: 'バリデーションエラー',
        message: `${invalidRows.length}件の行で駅名・事業者・路線のいずれかが未入力です`,
        color: 'red',
        autoClose: 4000,
      });
      return;
    }

    setSubmitting(true);
    const results = await Promise.allSettled(
      checkedRows.map((row) =>
        fetch('/api/unresolved-connections/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            odptStationId: row.odptStationId,
            name: row.jaName,
            nameEn: row.nameEn,
            code: row.stationCode,
            operatorId: row.operatorId,
            lineId: row.lineId || undefined,
          }),
        }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return row.odptStationId;
        })
      )
    );

    const succeeded: string[] = [];
    let failCount = 0;
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        succeeded.push(result.value);
      } else {
        failCount++;
      }
    });

    if (succeeded.length > 0) {
      onResolved(succeeded);
      notifications.show({
        title: '登録完了',
        message: `${succeeded.length}件の駅を登録しました`,
        color: 'green',
        autoClose: 4000,
      });
    }

    if (failCount > 0) {
      notifications.show({
        title: '一部登録失敗',
        message: `${failCount}件の登録に失敗しました`,
        color: 'red',
        autoClose: 6000,
      });
      setRows((prev) => prev.filter((r) => !succeeded.includes(r.odptStationId)));
    } else {
      onClose();
    }

    setSubmitting(false);
  }

  return (
    <Modal opened={opened} onClose={onClose} title="AI提案の確認（駅）" size="xl">
      <Group
        px="md"
        py="xs"
        gap="xs"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Checkbox
          checked={allChecked}
          indeterminate={!allChecked && someChecked}
          onChange={toggleAll}
          aria-label="全選択"
        />
        <Text size="xs" c="dimmed">全選択 / 解除</Text>
      </Group>
      <ScrollArea h={400} type="auto">
        <Stack gap={0}>
          {rows.map((row, i) => (
            <div
              key={row.odptStationId}
              style={{
                borderBottom: '1px solid var(--mantine-color-gray-3)',
                padding: '8px 16px',
                opacity: row.checked ? 1 : 0.4,
              }}
            >
              <Group gap="xs" mb={6} align="flex-start">
                <Checkbox
                  checked={row.checked}
                  onChange={(e) => updateRow(i, { checked: e.currentTarget.checked })}
                  mt={2}
                />
                <Text size="xs" ff="monospace" c="dimmed" style={{ wordBreak: 'break-all', flex: 1 }}>
                  {row.odptStationId}
                </Text>
              </Group>
              <Group gap="sm" align="flex-end" wrap="wrap" pl={26}>
                <TextInput
                  label="駅名 *"
                  value={row.jaName}
                  onChange={(e) => updateRow(i, { jaName: e.target.value })}
                  size="xs"
                  w={120}
                  disabled={!row.checked}
                  error={row.checked && !row.jaName.trim()}
                />
                <TextInput
                  label="英語名"
                  value={row.nameEn}
                  onChange={(e) => updateRow(i, { nameEn: e.target.value })}
                  size="xs"
                  w={120}
                  disabled={!row.checked}
                />
                <TextInput
                  label="駅コード"
                  value={row.stationCode}
                  onChange={(e) => updateRow(i, { stationCode: e.target.value })}
                  size="xs"
                  w={80}
                  placeholder="例: JC05"
                  disabled={!row.checked}
                />
                <NativeSelect
                  label="事業者 *"
                  data={[
                    { value: '', label: '選択' },
                    ...operators.map((o) => ({ value: o.id, label: o.name })),
                  ]}
                  value={row.operatorId}
                  onChange={(e) => updateRow(i, { operatorId: e.target.value })}
                  size="xs"
                  w={130}
                  disabled={!row.checked}
                  error={row.checked && !row.operatorId}
                />
                <NativeSelect
                  label="路線 *"
                  data={[
                    { value: '', label: '選択' },
                    ...lines.map((l) => ({ value: l.id, label: l.name })),
                  ]}
                  value={row.lineId}
                  onChange={(e) => updateRow(i, { lineId: e.target.value })}
                  size="xs"
                  w={130}
                  disabled={!row.checked}
                  error={row.checked && !row.lineId}
                />
              </Group>
            </div>
          ))}
        </Stack>
      </ScrollArea>
      <Group justify="space-between" mt="md">
        <Text size="sm" c="dimmed">{checkedCount}件を登録します</Text>
        <Group>
          <Button variant="default" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleBulkRegister} loading={submitting} disabled={checkedCount === 0 || hasInvalidCheckedRow}>
            一括登録
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}
