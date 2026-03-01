'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import type { CarStructure, FreeSpace, PrioritySeat } from '@furatora/database/schema';
import {
  ActionIcon, Button, Card, Checkbox, Group, Loader, MultiSelect, NativeSelect, NavLink,
  NumberInput, ScrollArea, SimpleGrid, Stack, Text, TextInput,
} from '@mantine/core';
import { Trash2 } from 'lucide-react';
import { notifications } from '@mantine/notifications';

type Operator = { id: string; name: string };
type Line = { id: string; name: string; nameEn: string; operatorId: string };
type PickerStation = { id: string; name: string };
type PickerPlatform = { id: string; platformNumber: number };

type TrainData = {
  id?: string;
  name: string;
  operatorId: string;
  lineIds: string[];
  carCount: number;
  carStructure: CarStructure[] | null;
  freeSpaces: FreeSpace[] | null;
  prioritySeats: PrioritySeat[] | null;
  limitedToPlatformIds: string[] | null;
};

type Props = {
  initialData?: TrainData;
  isEdit?: boolean;
};

export function TrainForm({ initialData, isEdit = false }: Props) {
  const router = useRouter();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [allLines, setAllLines] = useState<Line[]>([]);
  const [name, setName] = useState(initialData?.name ?? '');
  const [operatorId, setOperatorId] = useState(initialData?.operatorId ?? '');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(initialData?.lineIds ?? []);
  const [carCount, setCarCount] = useState(initialData?.carCount ?? 10);

  const initCarStructures = (): { carNumber: number; doorCount: number }[] => {
    const cs = initialData?.carStructure;
    if (cs && cs.length > 0) return cs;
    const count = initialData?.carCount ?? 10;
    return Array.from({ length: count }, (_, i) => ({ carNumber: i + 1, doorCount: 4 }));
  };
  const [carStructures, setCarStructures] = useState(initCarStructures);

  const [freeSpaces, setFreeSpaces] = useState<FreeSpace[]>(initialData?.freeSpaces ?? []);
  const [prioritySeats, setPrioritySeats] = useState<PrioritySeat[]>(initialData?.prioritySeats ?? []);
  const [limitedToPlatformIds, setLimitedToPlatformIds] = useState<string[]>(initialData?.limitedToPlatformIds ?? []);
  const [platformLabels, setPlatformLabels] = useState<Record<string, string>>({});
  const [pickerLineId, setPickerLineId] = useState<string | null>(null);
  const [pickerStationId, setPickerStationId] = useState<string | null>(null);
  const [pickerPlatformId, setPickerPlatformId] = useState<string | null>(null);
  const [pickerStations, setPickerStations] = useState<PickerStation[]>([]);
  const [pickerPlatforms, setPickerPlatforms] = useState<PickerPlatform[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const initialLimitedPlatformIds = useRef(initialData?.limitedToPlatformIds);

  useEffect(() => {
    const initialIds = initialLimitedPlatformIds.current;
    const fetches: Promise<void>[] = [
      fetch('/api/operators').then((r) => r.json()).then(setOperators),
      fetch('/api/lines').then((r) => r.json()).then(setAllLines),
    ];
    if (initialIds && initialIds.length > 0) {
      fetches.push(
        fetch(`/api/platforms?ids=${initialIds.join(',')}`)
          .then(r => r.json() as Promise<{ id: string; platformNumber: number; stationName: string; lineName: string }[]>)
          .then(data => {
            const labels: Record<string, string> = {};
            for (const p of data) {
              labels[p.id] = `${p.lineName} > ${p.stationName} > ${p.platformNumber}番ホーム`;
            }
            setPlatformLabels(labels);
          })
      );
    }
    Promise.all(fetches).then(() => setDataLoading(false));
  }, []);

  const pickerAvailableLines = allLines.filter(l => selectedLineIds.includes(l.id));

  function addFreeSpace() {
    setFreeSpaces((prev) => [...prev, { carNumber: 1, nearDoor: 1, isStandard: true }]);
  }
  function removeFreeSpace(index: number) {
    setFreeSpaces((prev) => prev.filter((_, i) => i !== index));
  }
  function updateFreeSpace(index: number, field: keyof FreeSpace, value: number | string | boolean) {
    setFreeSpaces((prev) => prev.map((fs, i) => (i === index ? { ...fs, [field]: value } : fs)));
  }

  function addPrioritySeat() {
    setPrioritySeats((prev) => [...prev, { carNumber: 1, nearDoor: 1, isStandard: true }]);
  }
  function removePrioritySeat(index: number) {
    setPrioritySeats((prev) => prev.filter((_, i) => i !== index));
  }
  function updatePrioritySeat(index: number, field: keyof PrioritySeat, value: number | string |boolean) {
    setPrioritySeats((prev) => prev.map((ps, i) => (i === index ? { ...ps, [field]: value } : ps)));
  }

  function selectPickerLine(lineId: string) {
    setPickerLineId(lineId);
    setPickerStationId(null);
    setPickerPlatformId(null);
    setPickerStations([]);
    setPickerPlatforms([]);
    fetch(`/api/stations?lineId=${lineId}`)
      .then(r => r.json() as Promise<PickerStation[]>)
      .then(setPickerStations);
  }

  function selectPickerStation(stationId: string) {
    setPickerStationId(stationId);
    setPickerPlatformId(null);
    setPickerPlatforms([]);
    fetch(`/api/stations/${stationId}/platforms`)
      .then(r => r.json() as Promise<PickerPlatform[]>)
      .then(setPickerPlatforms);
  }

  function addPickerPlatform() {
    if (!pickerPlatformId || limitedToPlatformIds.includes(pickerPlatformId)) return;
    const platformId = pickerPlatformId;
    const line = allLines.find(l => l.id === pickerLineId);
    const station = pickerStations.find(s => s.id === pickerStationId);
    const platform = pickerPlatforms.find(p => p.id === platformId);
    const label = `${line?.name ?? ''} > ${station?.name ?? ''} > ${platform?.platformNumber ?? ''}番ホーム`;
    setLimitedToPlatformIds(prev => [...prev, platformId]);
    setPlatformLabels(prev => ({ ...prev, [platformId]: label }));
  }

  function removeLimitedPlatform(id: string) {
    setLimitedToPlatformIds(prev => prev.filter(p => p !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // NumberInputからの空文字列をチェック
    const hasInvalidFreeSpace = freeSpaces.some(
      fs => typeof fs.carNumber !== 'number' || typeof fs.nearDoor !== 'number'
    );
    const hasInvalidPrioritySeat = prioritySeats.some(
      ps => typeof ps.carNumber !== 'number' || typeof ps.nearDoor !== 'number'
    );

    if (hasInvalidFreeSpace || hasInvalidPrioritySeat) {
      notifications.show({
        title: '更新エラー',
        message: '入力項目が不足しています。',
        color: 'red',
        autoClose: 3000,
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      name,
      operatorId,
      lineIds: selectedLineIds,
      carCount,
      carStructure: carStructures.length > 0 ? carStructures : null,
      freeSpaces: freeSpaces.length > 0 ? freeSpaces : null,
      prioritySeats: prioritySeats.length > 0 ? prioritySeats : null,
      limitedToPlatformIds: limitedToPlatformIds.length > 0 ? limitedToPlatformIds : null,
    };

    const url = isEdit ? `/api/trains/${initialData!.id}` : '/api/trains';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push('/trains');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  const lineSelectData = allLines.map((l) => ({ value: l.id, label: l.name }));

  if (dataLoading) {
    return (
      <Group gap="xs" align="center">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">データを読み込み中...</Text>
      </Group>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <TextInput
          label="列車名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <NativeSelect
          label="事業者"
          data={[
            { value: '', label: '事業者を選択' },
            ...operators.map((op) => ({ value: op.id, label: op.name })),
          ]}
          value={operatorId}
          onChange={(e) => {
            setOperatorId(e.target.value);
            setSelectedLineIds([]);
          }}
          required
        />

        <MultiSelect
          label="路線"
          searchable
          data={lineSelectData}
          value={selectedLineIds}
          onChange={setSelectedLineIds}
        />

        <NumberInput
          label="両数"
          min={1}
          max={17}
          value={carCount}
          onChange={(v) => {
            const newCount = typeof v === 'number' ? v : 10;
            setCarCount(newCount);
            setCarStructures((prev) =>
              Array.from({ length: newCount }, (_, i) => ({
                carNumber: i + 1,
                doorCount: prev[i]?.doorCount ?? 4,
              }))
            );
          }}
          required
          w={{ base: '100%', xs: 128 }}
        />

        <div>
          <Text size="sm" fw={500} mb="xs">車両構成（号車ごとのドア数）</Text>
          <Stack gap={4}>
            {carStructures.map((cs, i) => (
              <Group key={i} gap="sm" align="center">
                <Text size="sm" c="dimmed" w={56} ta="right">{cs.carNumber}号車</Text>
                <NumberInput
                  min={1}
                  max={6}
                  value={cs.doorCount}
                  onChange={(v) =>
                    setCarStructures((prev) =>
                      prev.map((c, j) => j === i ? { ...c, doorCount: typeof v === 'number' ? v : 4 } : c)
                    )
                  }
                  w={80}
                  size="xs"
                  suffix="ドア"
                />
              </Group>
            ))}
          </Stack>
        </div>

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>フリースペース</Text>
            <Button variant="subtle" size="compact-sm" onClick={addFreeSpace}>+ 追加</Button>
          </Group>
          <Stack gap="xs">
            {freeSpaces.map((fs, i) => (
              <Group key={i} gap="sm" align="center" wrap="wrap">
                <NumberInput label="号車" min={1} max={carCount} value={fs.carNumber}
                  onChange={(v) => updateFreeSpace(i, 'carNumber', v)}
                  w={80} size="xs"
                  error={typeof fs.carNumber === 'string' && fs.carNumber === ''}
                />
                <NumberInput label="ドア番号" min={1} value={fs.nearDoor}
                  onChange={(v) => updateFreeSpace(i, 'nearDoor', v)}
                  w={80} size="xs"
                  error={typeof fs.nearDoor === 'string' && fs.nearDoor === ''}
                />
                <Checkbox label="全編成装備" checked={fs.isStandard}
                  onChange={(e) => updateFreeSpace(i, 'isStandard', e.currentTarget.checked)}
                  size="sm" mt="lg"
                />
                <ActionIcon variant="filled" color="red" size="sm" onClick={() => removeFreeSpace(i)} mt="lg">
                  <Trash2 style={{ width: '70%', height: '70%' }}/>
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </div>

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>優先席</Text>
            <Button variant="subtle" size="compact-sm" onClick={addPrioritySeat}>+ 追加</Button>
          </Group>
          <Stack gap="xs">
            {prioritySeats.map((ps, i) => (
              <Group key={i} gap="sm" align="center" wrap="wrap">
                <NumberInput label="号車" min={1} max={carCount} value={ps.carNumber}
                  onChange={(v) => updatePrioritySeat(i, 'carNumber', v)}
                  w={80} size="xs"
                  error={typeof ps.carNumber === 'string' && ps.carNumber === ''}
                />
                <NumberInput label="ドア番号" min={1} value={ps.nearDoor}
                  onChange={(v) => updatePrioritySeat(i, 'nearDoor', v)}
                  w={80} size="xs"
                  error={typeof ps.nearDoor === 'string' && ps.nearDoor === ''}
                />
                <Checkbox label="全編成装備" checked={ps.isStandard}
                  onChange={(e) => updatePrioritySeat(i, 'isStandard', e.currentTarget.checked)}
                  size="sm" mt="lg"
                />
                <ActionIcon variant="filled" color="red" size="sm" onClick={() => removePrioritySeat(i)} mt="lg">
                  <Trash2 style={{ width: '70%', height: '70%' }}/>
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">
            走行制限ホーム
            <Text span size="xs" c="dimmed" fw={400} ml="xs">
              (区間限定運用のみ。制限なしの場合は空欄)
            </Text>
          </Text>

          {pickerAvailableLines.length > 0 ? (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} mb="xs">
                <Card withBorder padding={0}>
                  <ScrollArea h={192}>
                    {pickerAvailableLines.map(line => (
                      <NavLink
                        key={line.id}
                        label={line.name}
                        active={pickerLineId === line.id}
                        onClick={() => selectPickerLine(line.id)}
                      />
                    ))}
                  </ScrollArea>
                </Card>
                <Card withBorder padding={0}>
                  <ScrollArea h={192}>
                    {pickerStations.map(station => (
                      <NavLink
                        key={station.id}
                        label={station.name}
                        active={pickerStationId === station.id}
                        onClick={() => selectPickerStation(station.id)}
                      />
                    ))}
                  </ScrollArea>
                </Card>
                <Card withBorder padding={0}>
                  <ScrollArea h={192}>
                    {pickerPlatforms.map(platform => (
                      <NavLink
                        key={platform.id}
                        label={`${platform.platformNumber}番ホーム`}
                        active={pickerPlatformId === platform.id}
                        onClick={() => setPickerPlatformId(platform.id)}
                      />
                    ))}
                  </ScrollArea>
                </Card>
              </SimpleGrid>

              <Button
                size="compact-sm"
                onClick={addPickerPlatform}
                disabled={!pickerPlatformId || limitedToPlatformIds.includes(pickerPlatformId)}
                mb="sm"
              >
                追加
              </Button>
            </>
          ) : (
            <Text size="sm" c="dimmed" mb="sm">路線を選択してからホームを追加してください</Text>
          )}

          {limitedToPlatformIds.length === 0 ? (
            <Text size="sm" c="dimmed">走行制限なし</Text>
          ) : (
            <Stack gap="xs">
              {limitedToPlatformIds.map(id => (
                <Card key={id} withBorder padding="xs" bg="gray.0">
                  <Group justify="space-between">
                    <Text size="sm">{platformLabels[id] ?? id}</Text>
                    <Button
                      variant="subtle"
                      color="red"
                      size="compact-xs"
                      onClick={() => removeLimitedPlatform(id)}
                    >
                      削除
                    </Button>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </div>

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button variant="default" onClick={() => router.push('/trains')}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
