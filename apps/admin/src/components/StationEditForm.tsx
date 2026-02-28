'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StrollerDifficulty, WheelchairDifficulty } from '@furatora/database/enums';
import { STROLLER_DIFFICULTY_META, WHEELCHAIR_DIFFICULTY_META } from '@/constants/difficulty';
import {
  Button, Card, Group, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea, Title,
} from '@mantine/core';

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

type ConnectionState = {
  strollerDifficulty: StrollerDifficulty | '';
  wheelchairDifficulty: WheelchairDifficulty | '';
  notesAboutStroller: string;
  notesAboutWheelchair: string;
};

type Props = {
  stationId: string;
  initialNameKana: string | null;
  initialNotes: string | null;
  connections: ConnectionRow[];
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

export function StationEditForm({ stationId, initialNameKana, initialNotes, connections }: Props) {
  const router = useRouter();
  const [nameKana, setNameKana] = useState(initialNameKana ?? '');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>(() =>
    Object.fromEntries(
      connections.map((c) => [
        c.id,
        {
          strollerDifficulty: c.strollerDifficulty ?? '',
          wheelchairDifficulty: c.wheelchairDifficulty ?? '',
          notesAboutStroller: c.notesAboutStroller ?? '',
          notesAboutWheelchair: c.notesAboutWheelchair ?? '',
        },
      ])
    )
  );
  const [submitting, setSubmitting] = useState(false);

  function updateConnection(id: string, patch: Partial<ConnectionState>) {
    setConnectionStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave() {
    setSubmitting(true);

    const stationReq = fetch(`/api/stations/${stationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nameKana: nameKana || null,
        notes: notes || null,
      }),
    });

    const connectionReqs = connections.map((conn) => {
      const s = connectionStates[conn.id];
      return fetch(`/api/station-connections/${conn.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strollerDifficulty: s.strollerDifficulty || null,
          wheelchairDifficulty: s.wheelchairDifficulty || null,
          notesAboutStroller: s.notesAboutStroller || null,
          notesAboutWheelchair: s.notesAboutWheelchair || null,
        }),
      });
    });

    const results = await Promise.all([stationReq, ...connectionReqs]);
    const allOk = results.every((r) => r.ok);

    if (allOk) {
      router.push('/stations');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('Failed to save');
    }
  }

  return (
    <Stack gap="xl" maw="48rem">
      <section>
        <Title order={4} mb="md">駅情報</Title>
        <Stack gap="md">
          <TextInput
            label="よみがな - Optional"
            placeholder="例: かやばちょう"
            value={nameKana}
            onChange={(e) => setNameKana(e.target.value)}
          />
          <Textarea
            label="備考 - Optional"
            placeholder="例: 東急東横線との直通運転あり"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>
      </section>

      <section>
        <Title order={4} mb="md">
          乗り換え接続 ({connections.length}件)
        </Title>

        {connections.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">乗り換え接続情報がありません</Text>
        ) : (
          <Stack gap="lg">
            {connections.map((conn) => {
              const s = connectionStates[conn.id];
              return (
                <Card key={conn.id} withBorder padding="md">
                  <Text fw={500} size="sm" mb="md">{displayName(conn)}</Text>

                  <SimpleGrid cols={2} mb="md">
                    <NativeSelect
                      label="ベビーカー難易度"
                      data={strollerOptions}
                      value={s.strollerDifficulty}
                      onChange={(e) =>
                        updateConnection(conn.id, {
                          strollerDifficulty: e.target.value as StrollerDifficulty | '',
                        })
                      }
                    />
                    <NativeSelect
                      label="車いす難易度"
                      data={wheelchairOptions}
                      value={s.wheelchairDifficulty}
                      onChange={(e) =>
                        updateConnection(conn.id, {
                          wheelchairDifficulty: e.target.value as WheelchairDifficulty | '',
                        })
                      }
                    />
                  </SimpleGrid>

                  <SimpleGrid cols={2}>
                    <Textarea
                      label="ベビーカー備考"
                      placeholder="例: A2出口エレベーターを利用"
                      rows={2}
                      value={s.notesAboutStroller}
                      onChange={(e) =>
                        updateConnection(conn.id, { notesAboutStroller: e.target.value })
                      }
                    />
                    <Textarea
                      label="車いす備考"
                      placeholder="例: 駅員への申告が必要"
                      rows={2}
                      value={s.notesAboutWheelchair}
                      onChange={(e) =>
                        updateConnection(conn.id, { notesAboutWheelchair: e.target.value })
                      }
                    />
                  </SimpleGrid>
                </Card>
              );
            })}
          </Stack>
        )}
      </section>

      <Group gap="sm">
        <Button loading={submitting} onClick={handleSave}>
          Save
        </Button>
        <Button variant="default" onClick={() => router.push('/stations')}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
