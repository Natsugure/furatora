'use client';

import { useState } from 'react';
import {
  Button, Checkbox, Group, Modal, NativeSelect,
  ScrollArea, Table, Text, TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { RailwaySuggestion } from '@/actions/gemini';

type Operator = { id: string; name: string; odptOperatorId: string | null };

type BulkRailway = {
  odptRailwayId: string;
  suggestedName: string;
  operatorKey: string;
};

type RowState = {
  odptRailwayId: string;
  jaName: string;
  nameEn: string;
  lineCode: string;
  operatorId: string;
  checked: boolean;
};

export function RailwayBulkSuggestModal({
  opened,
  onClose,
  railways,
  suggestions,
  operators,
  onResolved,
}: {
  opened: boolean;
  onClose: () => void;
  railways: BulkRailway[];
  suggestions: RailwaySuggestion[];
  operators: Operator[];
  onResolved: (resolvedIds: string[]) => void;
}) {
  const [rows, setRows] = useState<RowState[]>(() =>
    railways.map((railway, i) => ({
      odptRailwayId: railway.odptRailwayId,
      jaName: suggestions[i]?.jaName || railway.suggestedName,
      nameEn: suggestions[i]?.nameEn || '',
      lineCode: suggestions[i]?.lineCode || '',
      operatorId:
        operators.find((o) =>
          o.odptOperatorId?.toLowerCase().includes(railway.operatorKey.toLowerCase())
        )?.id ?? '',
      checked: true,
    }))
  );
  const [submitting, setSubmitting] = useState(false);

  const allChecked = rows.length > 0 && rows.every((r) => r.checked);
  const someChecked = rows.some((r) => r.checked);
  const checkedCount = rows.filter((r) => r.checked).length;

  function updateRow(index: number, updates: Partial<RowState>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  }

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.currentTarget.checked;
    setRows((prev) => prev.map((row) => ({ ...row, checked: next })));
  }

  async function handleBulkRegister() {
    const checkedRows = rows.filter((r) => r.checked);
    const invalidRows = checkedRows.filter((r) => !r.jaName.trim() || !r.operatorId);
    if (invalidRows.length > 0) {
      notifications.show({
        title: 'バリデーションエラー',
        message: `${invalidRows.length}件の行で路線名または事業者が未入力です`,
        color: 'red',
        autoClose: 4000,
      });
      return;
    }

    setSubmitting(true);
    const results = await Promise.allSettled(
      checkedRows.map((row) =>
        fetch('/api/unresolved-connections/railways', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            odptRailwayId: row.odptRailwayId,
            name: row.jaName,
            nameEn: row.nameEn,
            operatorId: row.operatorId,
            lineCode: row.lineCode,
            color: '',
          }),
        }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return row.odptRailwayId;
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
        message: `${succeeded.length}件の路線を登録しました`,
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
      setRows((prev) => prev.filter((r) => !succeeded.includes(r.odptRailwayId)));
    } else {
      onClose();
    }

    setSubmitting(false);
  }

  return (
    <Modal opened={opened} onClose={onClose} title="AI提案の確認（路線）" size="xl">
      <ScrollArea h={400} type="auto">
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>
                <Checkbox
                  checked={allChecked}
                  indeterminate={!allChecked && someChecked}
                  onChange={toggleAll}
                  aria-label="全選択"
                />
              </Table.Th>
              <Table.Th>ODPT ID</Table.Th>
              <Table.Th>路線名 *</Table.Th>
              <Table.Th>英語名</Table.Th>
              <Table.Th>路線コード</Table.Th>
              <Table.Th>事業者 *</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row, i) => (
              <Table.Tr key={row.odptRailwayId} style={{ opacity: row.checked ? 1 : 0.4 }}>
                <Table.Td>
                  <Checkbox
                    checked={row.checked}
                    onChange={(e) => updateRow(i, { checked: e.currentTarget.checked })}
                  />
                </Table.Td>
                <Table.Td>
                  <Text
                    size="xs"
                    ff="monospace"
                    c="dimmed"
                    style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {row.odptRailwayId}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={row.jaName}
                    onChange={(e) => updateRow(i, { jaName: e.target.value })}
                    size="xs"
                    w={120}
                    disabled={!row.checked}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={row.nameEn}
                    onChange={(e) => updateRow(i, { nameEn: e.target.value })}
                    size="xs"
                    w={120}
                    disabled={!row.checked}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={row.lineCode}
                    onChange={(e) => updateRow(i, { lineCode: e.target.value })}
                    size="xs"
                    w={70}
                    placeholder="例: JC"
                    disabled={!row.checked}
                  />
                </Table.Td>
                <Table.Td>
                  <NativeSelect
                    data={[
                      { value: '', label: '選択' },
                      ...operators.map((o) => ({ value: o.id, label: o.name })),
                    ]}
                    value={row.operatorId}
                    onChange={(e) => updateRow(i, { operatorId: e.target.value })}
                    size="xs"
                    disabled={!row.checked}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Group justify="space-between" mt="md">
        <Text size="sm" c="dimmed">{checkedCount}件を登録します</Text>
        <Group>
          <Button variant="default" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleBulkRegister} loading={submitting} disabled={checkedCount === 0}>
            一括登録
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}
