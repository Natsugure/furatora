'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Button, Card, Checkbox, Collapse, Group, Loader, NativeSelect,
  NumberInput, Stack, Text, TextInput, Textarea,
} from '@mantine/core';

type Platform = {
  id: string;
  platformNumber: string;
};

type FacilityType = {
  code: string;
  name: string;
};

type ConnectedStation = {
  id: string;
  name: string;
  code: string | null;
  lineId: string;
  lineName: string;
}

type Connection = {
  stationId: string;
  exitLabel: string;
};

type FacilitySelection = {
  typeCode: string;
  isWheelchairAccessible: boolean;
  isStrollerAccessible: boolean;
  notes: string;
};

type LocationData = {
  id?: string;
  platformId: string;
  nearPlatformCell: number | null;
  exits: string;
  notes: string;
  facilities: FacilitySelection[];
  connections?: Connection[];
};

type Props = {
  stationId: string;
  initialData?: LocationData;
  isEdit?: boolean;
};

export function FacilityForm({ stationId, initialData, isEdit = false }: Props) {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<FacilityType[]>([]);
  const [connectedStations, setConnectedStations] = useState<ConnectedStation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [platformId, setPlatformId] = useState(initialData?.platformId ?? '');
  const [nearPlatformCell, setNearPlatformCell] = useState<number | ''>(initialData?.nearPlatformCell ?? '');
  const [exits, setExits] = useState(initialData?.exits ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [selectedFacilities, setSelectedFacilities] = useState<FacilitySelection[]>(
    initialData?.facilities ?? []
  );
  const [connections, setConnections] = useState<Connection[]>(initialData?.connections ?? []);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/stations/${stationId}/platforms`).then((r) => r.json()),
      fetch('/api/facility-types').then((r) => r.json()),
      fetch(`/api/stations?connectedFrom=${stationId}`).then((r) => r.json()),
    ]).then(([platformsData, typesData, stationsData]) => {
      setPlatforms(platformsData);
      setFacilityTypes(typesData);
      setConnectedStations(stationsData);
      setDataLoading(false);
    });
  }, [stationId]);

  function toggleFacilityType(typeCode: string) {
    setSelectedFacilities((prev) => {
      const exists = prev.find((f) => f.typeCode === typeCode);
      if (exists) {
        return prev.filter((f) => f.typeCode !== typeCode);
      }
      return [...prev, { typeCode, isWheelchairAccessible: true, isStrollerAccessible: true, notes: '' }];
    });
  }

  function updateFacility(typeCode: string, field: keyof Omit<FacilitySelection, 'typeCode'>, value: boolean | string) {
    setSelectedFacilities((prev) =>
      prev.map((f) => (f.typeCode === typeCode ? { ...f, [field]: value } : f))
    );
  }

  function addConnection() {
    setConnections((prev) => [...prev, { stationId: '', exitLabel: '' }]);
  }
  function removeConnection(index: number) {
    setConnections((prev) => prev.filter((_, i) => i !== index));
  }
  function updateConnection(index: number, field: keyof Connection, value: string) {
    setConnections((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedFacilities.length === 0) {
      alert('設備タイプを1つ以上選択してください');
      return;
    }
    setSubmitting(true);

    const payload = {
      platformId,
      nearPlatformCell: nearPlatformCell === '' ? null : nearPlatformCell,
      exits: exits || null,
      notes: notes || null,
      facilities: selectedFacilities,
      connections: connections.filter((c) => c.stationId !== ''),
    };

    const url = isEdit
      ? `/api/stations/${stationId}/platform-locations/${initialData!.id}`
      : `/api/stations/${stationId}/platform-locations`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(`/stations/${stationId}/facilities`);
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  if (dataLoading) {
    return <Loader />;
  }

  const connectedStationData = [
    { value: '', label: '駅を選択' },
    ...connectedStations.map((s) => ({ value: s.id, label: `${s.lineName} (${s.name})` })),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <NativeSelect
          label="ホーム"
          data={[
            { value: '', label: 'ホームを選択' },
            ...platforms.map((p) => ({ value: p.id, label: `${p.platformNumber}番ホーム` })),
          ]}
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)}
          required
        />

        <NumberInput
          label="ホーム枠番号"
          description="設備が位置するホームの枠番号（1〜maxCarCount）。空欄でホーム全体。"
          min={1}
          placeholder="例: 3"
          value={nearPlatformCell}
          onChange={(v) => setNearPlatformCell(typeof v === 'number' ? v : '')}
          w={128}
        />

        <TextInput
          label="出口"
          description="この場所に繋がる出口を記載してください"
          placeholder="例: A3出口・B1出口"
          value={exits}
          onChange={(e) => setExits(e.target.value)}
        />

        <Textarea
          label="場所メモ"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div>
          <Text size="sm" fw={500} mb="xs">設備タイプ</Text>
          <Text size="xs" c="dimmed" mb="sm">
            この場所にある設備を選択してください（複数選択可）
          </Text>
          <Stack gap="xs">
            {facilityTypes.map((ft) => {
              const selected = selectedFacilities.find((f) => f.typeCode === ft.code);
              return (
                <Card key={ft.code} withBorder padding="sm">
                  <Checkbox
                    label={ft.name}
                    checked={!!selected}
                    onChange={() => toggleFacilityType(ft.code)}
                    fw={500}
                  />
                  <Collapse in={!!selected}>
                    <Stack gap="xs" mt="sm" ml="xl">
                      <Group gap="lg">
                        <Checkbox
                          label="車いす対応"
                          checked={selected?.isWheelchairAccessible ?? false}
                          onChange={(e) => updateFacility(ft.code, 'isWheelchairAccessible', e.currentTarget.checked)}
                          size="sm"
                        />
                        <Checkbox
                          label="ベビーカー対応"
                          checked={selected?.isStrollerAccessible ?? false}
                          onChange={(e) => updateFacility(ft.code, 'isStrollerAccessible', e.currentTarget.checked)}
                          size="sm"
                        />
                      </Group>
                      <TextInput
                        placeholder="設備メモ（任意）"
                        value={selected?.notes ?? ''}
                        onChange={(e) => updateFacility(ft.code, 'notes', e.target.value)}
                        size="sm"
                      />
                    </Stack>
                  </Collapse>
                </Card>
              );
            })}
          </Stack>
          {selectedFacilities.length === 0 && (
            <Text size="sm" c="red" mt="xs">設備タイプを1つ以上選択してください</Text>
          )}
        </div>

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>乗換可能な駅</Text>
            <Button variant="subtle" size="compact-sm" onClick={addConnection}>
              + 接続を追加
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mb="xs">
            この場所を経由して乗り換え可能な駅と、対応する出口ラベルを指定してください
          </Text>
          {connections.length === 0 && (
            <Text size="sm" c="dimmed" fs="italic">接続なし</Text>
          )}
          <Stack gap="xs">
            {connections.map((conn, i) => (
              <Group key={i} gap="xs" wrap="nowrap">
                <NativeSelect
                  data={connectedStationData}
                  value={conn.stationId}
                  onChange={(e) => updateConnection(i, 'stationId', e.target.value)}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <TextInput
                  placeholder="出口ラベル (例: A3出口)"
                  value={conn.exitLabel}
                  onChange={(e) => updateConnection(i, 'exitLabel', e.target.value)}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  onClick={() => removeConnection(i)}
                >
                  削除
                </Button>
              </Group>
            ))}
          </Stack>
        </div>

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button variant="default" onClick={() => router.push(`/stations/${stationId}/facilities`)}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
