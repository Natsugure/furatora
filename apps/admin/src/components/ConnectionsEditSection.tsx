'use client';

import { useState } from 'react';
import type { StrollerDifficulty, WheelchairDifficulty } from '@furatora/database/enums';
import { STROLLER_DIFFICULTY_META, WHEELCHAIR_DIFFICULTY_META } from '@/constants/difficulty';
import { Button, Card, Group, NativeSelect, SimpleGrid, Stack, Text, Textarea } from '@mantine/core';

export type ConnectionRow = {
  id: string;
  connectedStationName: string | null;
  connectedLineName: string | null;
  odptStationId: string | null;
  odptRailwayId: string | null;
  strollerDifficulty: StrollerDifficulty | null;
  wheelchairDifficulty: WheelchairDifficulty | null;
  notesAboutStroller: string | null;
  notesAboutWheelchair: string | null;
};

type ConnectionFormState = {
  strollerDifficulty: StrollerDifficulty | '';
  wheelchairDifficulty: WheelchairDifficulty | '';
  notesAboutStroller: string;
  notesAboutWheelchair: string;
  saving: boolean;
  saved: boolean;
};

function displayName(conn: ConnectionRow): string {
  if (conn.connectedStationName && conn.connectedLineName) {
    return `${conn.connectedLineName} — ${conn.connectedStationName}`;
  }
  if (conn.connectedLineName) return conn.connectedLineName;
  if (conn.connectedStationName) return conn.connectedStationName;
  const railway = conn.odptRailwayId?.replace('odpt.Railway:', '') ?? '';
  const station = conn.odptStationId?.replace('odpt.Station:', '') ?? '';
  return station || railway || '(不明)';
}

const strollerOptions = [
  { value: '', label: '— 未設定 —' },
  ...Object.entries(STROLLER_DIFFICULTY_META)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, { label }]) => ({ value: key, label })),
];

const wheelchairOptions = [
  { value: '', label: '— 未設定 —' },
  ...Object.entries(WHEELCHAIR_DIFFICULTY_META)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, { label }]) => ({ value: key, label })),
];

type Props = {
  connections: ConnectionRow[];
};

export function ConnectionsEditSection({ connections }: Props) {
  const [states, setStates] = useState<Record<string, ConnectionFormState>>(() =>
    Object.fromEntries(
      connections.map((c) => [
        c.id,
        {
          strollerDifficulty: c.strollerDifficulty ?? '',
          wheelchairDifficulty: c.wheelchairDifficulty ?? '',
          notesAboutStroller: c.notesAboutStroller ?? '',
          notesAboutWheelchair: c.notesAboutWheelchair ?? '',
          saving: false,
          saved: false,
        },
      ])
    )
  );

  function update(id: string, patch: Partial<ConnectionFormState>) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave(id: string) {
    const s = states[id];
    update(id, { saving: true, saved: false });
    const res = await fetch(`/api/station-connections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strollerDifficulty: s.strollerDifficulty || null,
        wheelchairDifficulty: s.wheelchairDifficulty || null,
        notesAboutStroller: s.notesAboutStroller || null,
        notesAboutWheelchair: s.notesAboutWheelchair || null,
      }),
    });
    if (res.ok) {
      update(id, { saving: false, saved: true });
    } else {
      update(id, { saving: false });
      alert('Failed to save');
    }
  }

  if (connections.length === 0) {
    return (
      <Text size="sm" c="dimmed" fs="italic">乗り換え接続情報がありません</Text>
    );
  }

  return (
    <Stack gap="lg">
      {connections.map((conn) => {
        const s = states[conn.id];
        return (
          <Card key={conn.id} withBorder padding="md">
            <Text fw={500} size="sm" mb="md">{displayName(conn)}</Text>

            <SimpleGrid cols={2} mb="md">
              <NativeSelect
                label="ベビーカー難易度"
                data={strollerOptions}
                value={s.strollerDifficulty}
                onChange={(e) =>
                  update(conn.id, {
                    strollerDifficulty: e.target.value as StrollerDifficulty | '',
                    saved: false,
                  })
                }
              />
              <NativeSelect
                label="車いす難易度"
                data={wheelchairOptions}
                value={s.wheelchairDifficulty}
                onChange={(e) =>
                  update(conn.id, {
                    wheelchairDifficulty: e.target.value as WheelchairDifficulty | '',
                    saved: false,
                  })
                }
              />
            </SimpleGrid>

            <SimpleGrid cols={2} mb="md">
              <Textarea
                label="ベビーカー備考"
                placeholder="例: A2出口エレベーターを利用"
                rows={2}
                value={s.notesAboutStroller}
                onChange={(e) =>
                  update(conn.id, { notesAboutStroller: e.target.value, saved: false })
                }
              />
              <Textarea
                label="車いす備考"
                placeholder="例: 駅員への申告が必要"
                rows={2}
                value={s.notesAboutWheelchair}
                onChange={(e) =>
                  update(conn.id, { notesAboutWheelchair: e.target.value, saved: false })
                }
              />
            </SimpleGrid>

            <Group gap="sm">
              <Button size="compact-sm" loading={s.saving} onClick={() => handleSave(conn.id)}>
                Save
              </Button>
              {s.saved && (
                <Text size="xs" c="green">保存しました</Text>
              )}
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}
