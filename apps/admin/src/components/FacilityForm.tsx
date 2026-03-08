'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Button, Card, Checkbox, Collapse, Group, Loader, NativeSelect,
  NumberInput, Stack, Text, TextInput, Textarea, Title,
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
  lineId: string | null;
  lineName: string | null;
  odptRailwayId: string | null;
}

type Direction = {
  id: string;
  displayName: string;
};

type ConnectedStationPlatform = {
  id: string;
  platformNumber: string;
};

type Connection = {
  stationId: string;
  connectedPlatformId: string | null;
  directionId: string | null;
  exitLabel: string;
};

type FacilitySelection = {
  typeCode: string;
  isWheelchairAccessible: boolean;
  isStrollerAccessible: boolean;
  notes: string;
};

type CellData = {
  nearPlatformCell: number | null;
  facilities: FacilitySelection[];
};

type LocationData = {
  id?: string;
  platformId: string;
  exits: string;
  notes: string;
  cells: CellData[];
  connections?: Connection[];
};

type CellState = {
  nearPlatformCell: number | '';
  facilities: FacilitySelection[];
};

type ConnectionRowState = {
  stationId: string;
  connectedPlatformId: string | null;
  directionId: string | null;
  notes: string;
  checked: boolean;
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
  const [connectedStationPlatforms, setConnectedStationPlatforms] = useState<Record<string, ConnectedStationPlatform[]>>({});
  const [connectedStationDirections, setConnectedStationDirections] = useState<Record<string, Direction[]>>({});
  const [dataLoading, setDataLoading] = useState(true);

  const [platformId, setPlatformId] = useState(initialData?.platformId ?? '');
  const [exits, setExits] = useState(initialData?.exits ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [cells, setCells] = useState<CellState[]>(
    initialData?.cells.map((c) => ({
      nearPlatformCell: c.nearPlatformCell ?? '',
      facilities: c.facilities,
    })) ?? [{ nearPlatformCell: '', facilities: [] }]
  );
  const [connectionRows, setConnectionRows] = useState<ConnectionRowState[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/stations/${stationId}/platforms`).then((r) => r.json()),
      fetch('/api/facility-types').then((r) => r.json()),
      fetch(`/api/stations?connectedFrom=${stationId}`).then((r) => r.json()),
    ]).then(([platformsData, typesData, stationsData]: [
      Platform[],
      FacilityType[],
      ConnectedStation[],
    ]) => {
      setPlatforms(platformsData);
      setFacilityTypes(typesData);
      setConnectedStations(stationsData);

      // 全接続候補駅のプラットフォーム・方面を一括ロード
      if (stationsData.length > 0) {
        Promise.all(
          stationsData.map((station) =>
            Promise.all([
              fetch(`/api/stations/${station.id}/platforms`).then((r) => r.json()),
              fetch(`/api/stations/${station.id}/directions`).then((r) => r.json()),
            ]).then(([stPlatforms, stDirections]: [ConnectedStationPlatform[], Direction[]]) => ({
              id: station.id,
              stPlatforms,
              stDirections,
            }))
          )
        ).then((results) => {
          const newPlatforms: Record<string, ConnectedStationPlatform[]> = {};
          const newDirections: Record<string, Direction[]> = {};
          for (const { id, stPlatforms, stDirections } of results) {
            newPlatforms[id] = stPlatforms;
            newDirections[id] = stDirections;
          }
          setConnectedStationPlatforms(newPlatforms);
          setConnectedStationDirections(newDirections);
        });
      }

      // connectionRows を接続候補全駅で初期化（編集時は既存データを反映）
      setConnectionRows(
        stationsData.map((station) => {
          const existing = initialData?.connections?.find((c) => c.stationId === station.id);
          return {
            stationId: station.id,
            connectedPlatformId: existing?.connectedPlatformId ?? null,
            directionId: existing?.directionId ?? null,
            notes: existing?.exitLabel ?? '',
            checked: !!existing,
          };
        })
      );

      setDataLoading(false);
    });
  }, [stationId, initialData?.connections]);

  function addCell() {
    setCells((prev) => [...prev, { nearPlatformCell: '', facilities: [] }]);
  }

  function removeCell(cellIndex: number) {
    setCells((prev) => prev.filter((_, i) => i !== cellIndex));
  }

  function updateCellNearPlatformCell(cellIndex: number, value: number | '') {
    setCells((prev) =>
      prev.map((cell, i) => (i === cellIndex ? { ...cell, nearPlatformCell: value } : cell))
    );
  }

  function toggleFacilityType(cellIndex: number, typeCode: string) {
    setCells((prev) =>
      prev.map((cell, i) => {
        if (i !== cellIndex) return cell;
        const exists = cell.facilities.find((f) => f.typeCode === typeCode);
        if (exists) {
          return { ...cell, facilities: cell.facilities.filter((f) => f.typeCode !== typeCode) };
        }
        return {
          ...cell,
          facilities: [...cell.facilities, { typeCode, isWheelchairAccessible: true, isStrollerAccessible: true, notes: '' }],
        };
      })
    );
  }

  function updateFacility(
    cellIndex: number,
    typeCode: string,
    field: keyof Omit<FacilitySelection, 'typeCode'>,
    value: boolean | string
  ) {
    setCells((prev) =>
      prev.map((cell, i) => {
        if (i !== cellIndex) return cell;
        return {
          ...cell,
          facilities: cell.facilities.map((f) =>
            f.typeCode === typeCode ? { ...f, [field]: value } : f
          ),
        };
      })
    );
  }

  function updateConnectionRow(index: number, updates: Partial<ConnectionRowState>) {
    setConnectionRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cells.length === 0) {
      alert('アクセス点を1つ以上追加してください');
      return;
    }
    if (cells.some((cell) => cell.facilities.length === 0)) {
      alert('各アクセス点に設備タイプを1つ以上選択してください');
      return;
    }
    setSubmitting(true);

    const payload = {
      platformId,
      exits: exits || null,
      notes: notes || null,
      cells: cells.map((cell) => ({
        nearPlatformCell: typeof cell.nearPlatformCell === 'number' ? cell.nearPlatformCell : null,
        facilities: cell.facilities.map((f) => ({
          typeCode: f.typeCode,
          isWheelchairAccessible: f.isWheelchairAccessible,
          isStrollerAccessible: f.isStrollerAccessible,
          notes: f.notes || null,
        })),
      })),
      connections: connectionRows.filter((r) => r.checked).map((r) => ({
        stationId: r.stationId,
        connectedPlatformId: r.connectedPlatformId || null,
        directionId: r.directionId || null,
        exitLabel: r.notes || null,
      })),
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
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>アクセス点</Text>
            <Button variant="subtle" size="compact-sm" onClick={addCell}>
              + アクセス点を追加
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mb="sm">
            ホーム上の設備位置（枠番号）ごとにアクセス点を登録してください
          </Text>
          {cells.length === 0 && (
            <Text size="sm" c="red" mt="xs">アクセス点を1つ以上追加してください</Text>
          )}
          <Stack gap="sm">
            {cells.map((cell, cellIndex) => (
              <Card key={cellIndex} withBorder padding="md">
                <Group justify="space-between" mb="sm">
                  <Title order={5}>アクセス点 {cellIndex + 1}</Title>
                  {cells.length > 1 && (
                    <Button
                      variant="subtle"
                      color="red"
                      size="compact-sm"
                      onClick={() => removeCell(cellIndex)}
                    >
                      削除
                    </Button>
                  )}
                </Group>

                <NumberInput
                  label="ホーム枠番号"
                  description="設備が位置するホームの枠番号（1〜maxCarCount）。空欄でホーム全体。"
                  min={1}
                  placeholder="例: 3"
                  value={cell.nearPlatformCell}
                  onChange={(v) => updateCellNearPlatformCell(cellIndex, typeof v === 'number' ? v : '')}
                  w={128}
                  mb="sm"
                />

                <Text size="sm" fw={500} mb="xs">設備タイプ</Text>
                <Stack gap="xs">
                  {facilityTypes.map((ft) => {
                    const selected = cell.facilities.find((f) => f.typeCode === ft.code);
                    return (
                      <Card key={ft.code} withBorder padding="sm">
                        <Checkbox
                          label={ft.name}
                          checked={!!selected}
                          onChange={() => toggleFacilityType(cellIndex, ft.code)}
                          fw={500}
                        />
                        <Collapse in={!!selected}>
                          <Stack gap="xs" mt="sm" ml="xl">
                            <Group gap="lg">
                              <Checkbox
                                label="車いす対応"
                                checked={selected?.isWheelchairAccessible ?? false}
                                onChange={(e) => updateFacility(cellIndex, ft.code, 'isWheelchairAccessible', e.currentTarget.checked)}
                                size="sm"
                              />
                              <Checkbox
                                label="ベビーカー対応"
                                checked={selected?.isStrollerAccessible ?? false}
                                onChange={(e) => updateFacility(cellIndex, ft.code, 'isStrollerAccessible', e.currentTarget.checked)}
                                size="sm"
                              />
                            </Group>
                            <TextInput
                              placeholder="設備メモ（任意）"
                              value={selected?.notes ?? ''}
                              onChange={(e) => updateFacility(cellIndex, ft.code, 'notes', e.target.value)}
                              size="sm"
                            />
                          </Stack>
                        </Collapse>
                      </Card>
                    );
                  })}
                </Stack>
                {cell.facilities.length === 0 && (
                  <Text size="sm" c="red" mt="xs">設備タイプを1つ以上選択してください</Text>
                )}
              </Card>
            ))}
          </Stack>
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">乗換可能な駅</Text>
          <Text size="xs" c="dimmed" mb="xs">
            この場所を経由して乗り換え可能な駅にチェックを入れてください
          </Text>
          {connectionRows.length === 0 && (
            <Text size="sm" c="dimmed" fs="italic">接続可能な駅がありません</Text>
          )}
          <Stack gap={0} bg="white" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)' }}>
            {connectionRows.map((row, i) => {
              const station = connectedStations.find((s) => s.id === row.stationId);
              const stationPlatforms = connectedStationPlatforms[row.stationId] ?? [];
              const stationDirections = connectedStationDirections[row.stationId] ?? [];
              const lineLabel = station
                ? (station.lineName ?? station.odptRailwayId?.replace('odpt.Railway:', '') ?? '(路線不明)')
                : '(読込中)';
              const stationLabel = station ? station.name : row.stationId;
              return (
                <div
                  key={row.stationId}
                  style={{
                    borderBottom: i < connectionRows.length - 1 ? '1px solid var(--mantine-color-gray-3)' : undefined,
                    padding: '10px 14px',
                    opacity: row.checked ? 1 : 0.5,
                  }}
                >
                  <Group gap="sm" align="flex-start">
                    <Checkbox
                      checked={row.checked}
                      onChange={(e) => updateConnectionRow(i, { checked: e.currentTarget.checked })}
                      mt={2}
                    />
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <div>
                        <Text size="sm" fw={500}>{lineLabel}</Text>
                        <Text size="xs" c="dimmed">{stationLabel}</Text>
                      </div>
                      <Group gap="xs" grow>
                        <NativeSelect
                          data={[
                            { value: '', label: 'ホームを選択（任意）' },
                            ...stationPlatforms.map((p) => ({
                              value: p.id,
                              label: `${p.platformNumber}番ホーム`,
                            })),
                          ]}
                          value={row.connectedPlatformId ?? ''}
                          onChange={(e) => updateConnectionRow(i, { connectedPlatformId: e.target.value || null })}
                          disabled={!row.checked}
                          size="xs"
                        />
                        <NativeSelect
                          data={[
                            { value: '', label: '方面を選択（任意）' },
                            ...stationDirections.map((d) => ({
                              value: d.id,
                              label: d.displayName,
                            })),
                          ]}
                          value={row.directionId ?? ''}
                          onChange={(e) => updateConnectionRow(i, { directionId: e.target.value || null })}
                          disabled={!row.checked}
                          size="xs"
                        />
                      </Group>
                      <TextInput
                        placeholder="備考（任意）"
                        value={row.notes}
                        onChange={(e) => updateConnectionRow(i, { notes: e.target.value })}
                        disabled={!row.checked}
                        size="xs"
                      />
                    </Stack>
                  </Group>
                </div>
              );
            })}
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
