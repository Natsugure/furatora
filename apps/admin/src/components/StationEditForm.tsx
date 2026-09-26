'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import type { ConnectionRow, OperatorOption } from '@/features/station/ports';
import { DeleteButton } from '@/components/DeleteButton';
import { LinkAnchor } from '@/components/LinkElements';
import { describeError } from '@/features/station-publishing/describeError';
import {
  Button, Card, Group, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea, Title,
} from '@mantine/core';

export type { ConnectionRow } from '@/features/station/ports';

type Props = {
  stationId: string;
  initialData: {
    name: string;
    nameKana: string | null;
    nameEn: string | null;
    odptStationId: string | null;
    slug: string | null;
    code: string | null;
    lat: string | null;
    lon: string | null;
    operatorId: string;
    notes: string | null;
  };
  connections: ConnectionRow[];
  operators: OperatorOption[];
  /** 「駅一覧に戻る」と同じ、直前の一覧の絞り込み状態を保持したhref */
  backHref: string;
};

function displayName(conn: ConnectionRow): string {
  if (conn.connectedStationName && conn.connectedLineName) {
    return `${conn.connectedLineName} — ${conn.connectedStationName}`;
  }
  if (conn.connectedLineName) return conn.connectedLineName;
  if (conn.connectedStationName) return conn.connectedStationName;
  return '(不明)';
}

export function StationEditForm({ stationId, initialData, connections, operators, backHref }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialData.name);
  const [nameKana, setNameKana] = useState(initialData.nameKana ?? '');
  const [nameEn, setNameEn] = useState(initialData.nameEn ?? '');
  const [odptStationId, setOdptStationId] = useState(initialData.odptStationId ?? '');
  const [slug, setSlug] = useState(initialData.slug ?? '');
  const [code, setCode] = useState(initialData.code ?? '');
  const [lat, setLat] = useState(initialData.lat ?? '');
  const [lon, setLon] = useState(initialData.lon ?? '');
  const [operatorId, setOperatorId] = useState(initialData.operatorId);
  const [notes, setNotes] = useState(initialData.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);

    const stationReq = fetch(`/api/stations/${stationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        nameKana: nameKana || null,
        nameEn: nameEn || null,
        odptStationId: odptStationId || null,
        slug: slug || null,
        code: code || null,
        lat: lat || null,
        lon: lon || null,
        operatorId,
        notes: notes || null,
      }),
    });

    // 乗換難易度はこの画面では保存しない。接続ごとの「乗換難易度を編集」から駅対の編集画面で入力する（#124）
    const res = await stationReq;

    if (res.ok) {
      notifications.show({ title: '保存しました', message: '駅情報を更新しました', color: 'green' });
      router.refresh();
    } else {
      const body: unknown = await res.json().catch(() => null);
      notifications.show({ title: '保存に失敗しました', message: describeError(body), color: 'red' });
    }
    setSubmitting(false);
  }

  const operatorOptions = operators.map((op) => ({ value: op.id, label: op.name }));

  return (
    <Stack gap="xl" maw="48rem">
      <section>
        <Title order={4} mb="md">駅情報</Title>
        <Stack gap="md">
          <TextInput
            label="駅名"
            placeholder="例: 茅場町"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextInput
            label="よみがな - 任意"
            placeholder="例: かやばちょう"
            value={nameKana}
            onChange={(e) => setNameKana(e.target.value)}
          />
          <TextInput
            label="英語名 - 任意"
            placeholder="例: Kayabacho"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
          <NativeSelect
            label="事業者"
            required
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            data={operatorOptions}
          />
          <TextInput
            label="ODPTコード - 任意"
            placeholder="例: odpt.Station:TokyoMetro.Hibiya.Kayabacho"
            value={odptStationId}
            onChange={(e) => setOdptStationId(e.target.value)}
          />
          <TextInput
            label="スラッグ - 任意"
            placeholder="例: tokyo-metro-hibiya-kayabacho"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <TextInput
            label="駅コード - 任意"
            placeholder="例: H14"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <SimpleGrid cols={2}>
            <TextInput
              label="緯度 - 任意"
              placeholder="例: 35.681236"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <TextInput
              label="経度 - 任意"
              placeholder="例: 139.767125"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
            />
          </SimpleGrid>
          <Textarea
            label="備考 - 任意"
            placeholder="例: 東急東横線との直通運転あり"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>
      </section>

      <section>
        <Group justify="space-between" mb="md">
          <Title order={4}>
            乗り換え接続 ({connections.length}件)
          </Title>
          {/* connections/new は ?operatorId=&lineId= を乗換候補の絞り込みに使っており、
              一覧の状態と同名で衝突するため一覧の状態は渡さない。
              connections/new からの「駅の編集に戻る」は素の /stations/:id/edit になる */}
          <LinkAnchor href={`/stations/${stationId}/connections/new`} size="sm">
            + 接続を追加
          </LinkAnchor>
        </Group>

        {connections.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">乗り換え接続情報がありません</Text>
        ) : (
          <Stack gap="lg">
            {connections.map((conn) => (
              <Card key={conn.id} withBorder padding="md">
                <Group justify="space-between">
                  <Text fw={500} size="sm">{displayName(conn)}</Text>
                  <Group gap="md">
                    {/* 乗換難易度は、駅対の編集画面（方面の組み合わせ4通りとルート）で入力する（#124）。
                        この画面の保存ボタンとは別に保存される */}
                    <LinkAnchor
                      href={`/stations/${stationId}/connections/${conn.connectedStationId}/transfer`}
                      size="sm"
                    >
                      乗換難易度を編集
                    </LinkAnchor>
                    <DeleteButton
                      endpoint={`/api/stations/${stationId}/connections/${conn.connectedStationId}`}
                      label="接続を削除"
                      description="この接続と、この駅対の乗換難易度（ルート・設備を含む評価データ）を削除します。元に戻せません。"
                    />
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </section>

      <Group gap="sm">
        <Button loading={submitting} onClick={handleSave}>
          保存
        </Button>
        <Button variant="default" onClick={() => router.push(backHref)}>
          キャンセル
        </Button>
      </Group>
    </Stack>
  );
}
