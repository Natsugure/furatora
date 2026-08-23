'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button, Group, NativeSelect, NumberInput, Radio, Stack, Table, Text, Title,
} from '@mantine/core';
import { buildCarSegments, type CarNumberOrder, type CarSegment } from '../domain/carSegments';

type TrainOption = {
  id: string;
  name: string;
  carCount: number;
  cars: { carNumber: number; carLength: number | null }[];
};

type InitialPattern = {
  id: string;
  trainId: string;
  cars: CarSegment[];
};

type Props = {
  stationId: string;
  platformId: string;
  platformNumber: string;
  physicalLength: number;
  trains: TrainOption[];
  initialData?: InitialPattern;
  isEdit?: boolean;
};

export function TrainStopPatternForm({
  stationId, platformId, platformNumber, physicalLength, trains, initialData, isEdit = false,
}: Props) {
  const router = useRouter();
  const [trainId, setTrainId] = useState(initialData?.trainId ?? '');
  const [boundaryMeters, setBoundaryMeters] = useState<number | ''>(0);
  const [order, setOrder] = useState<CarNumberOrder>('carOneNearest');
  const [cars, setCars] = useState<CarSegment[]>(initialData?.cars ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedTrain = trains.find((t) => t.id === trainId);

  function handlePreview() {
    if (!selectedTrain) {
      setErrorMessage('列車を選択してください');
      return;
    }
    setErrorMessage(null);
    setCars(buildCarSegments(selectedTrain.cars, typeof boundaryMeters === 'number' ? boundaryMeters : 0, order));
  }

  function updateCar(carNumber: number, field: 'startMeters' | 'endMeters', value: number | '') {
    if (value === '') return;
    setCars((prev) => prev.map((c) => (c.carNumber === carNumber ? { ...c, [field]: value } : c)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!trainId) {
      setErrorMessage('列車を選択してください');
      return;
    }
    if (cars.length === 0) {
      setErrorMessage('「自動計算してプレビュー」で号車ごとの位置を算出してください');
      return;
    }
    if (cars.some((c) => c.startMeters >= c.endMeters)) {
      setErrorMessage('開始位置は終了位置より小さい値にしてください');
      return;
    }

    setSubmitting(true);

    const payload = {
      platformId,
      trainId,
      cars: cars.map((c) => ({ carNumber: c.carNumber, startMeters: c.startMeters, endMeters: c.endMeters })),
    };

    const url = isEdit
      ? `/api/stations/${stationId}/train-stop-patterns/${initialData!.id}`
      : `/api/stations/${stationId}/train-stop-patterns`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(`/stations/${stationId}/platforms/${platformId}/stop-patterns`);
      router.refresh();
    } else {
      setSubmitting(false);
      if (res.status === 409) {
        setErrorMessage('このホーム・列車の組み合わせには既に停車位置パターンが登録されています');
      } else {
        setErrorMessage('保存に失敗しました');
      }
    }
  }

  const sortedCars = [...cars].sort((a, b) => a.carNumber - b.carNumber);

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <div>
          <Text size="sm" fw={500}>ホーム</Text>
          <Text size="sm" c="dimmed">
            {platformNumber}番線（ホーム長: {physicalLength.toFixed(2)} m）
          </Text>
        </div>

        <NativeSelect
          label="列車"
          data={[
            { value: '', label: '列車を選択' },
            ...trains.map((t) => ({ value: t.id, label: `${t.name}（${t.carCount}両）` })),
          ]}
          value={trainId}
          onChange={(e) => {
            setTrainId(e.target.value);
            setCars([]);
          }}
          required
        />

        <NumberInput
          label="編成の端の位置"
          description="x=0 に近い側の端の、ホーム端（x=0）からの距離"
          step={0.1}
          decimalScale={2}
          value={boundaryMeters}
          onChange={(v) => setBoundaryMeters(typeof v === 'number' ? v : '')}
          suffix=" m"
          w={200}
        />

        <Radio.Group
          label="号車番号の向き"
          value={order}
          onChange={(v) => setOrder(v as CarNumberOrder)}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="carOneNearest" label="x=0 に近い側が 1号車（号車番号が増えるほど x が大きくなる）" />
            <Radio value="lastCarNearest" label="x=0 に近い側が 最終号車（号車番号が増えるほど x が小さくなる）" />
          </Stack>
        </Radio.Group>

        <Button type="button" variant="light" onClick={handlePreview} disabled={!trainId}>
          自動計算してプレビュー
        </Button>

        {sortedCars.length > 0 && (
          <div>
            <Title order={5} mb="xs">号車ごとの位置（上書き可）</Title>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>号車</Table.Th>
                  <Table.Th>開始位置 (m)</Table.Th>
                  <Table.Th>終了位置 (m)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedCars.map((c) => (
                  <Table.Tr key={c.carNumber}>
                    <Table.Td>{c.carNumber}号車</Table.Td>
                    <Table.Td>
                      <NumberInput
                        step={0.1}
                        decimalScale={2}
                        value={c.startMeters}
                        onChange={(v) => updateCar(c.carNumber, 'startMeters', typeof v === 'number' ? v : '')}
                        size="xs"
                        w={110}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        step={0.1}
                        decimalScale={2}
                        value={c.endMeters}
                        onChange={(v) => updateCar(c.carNumber, 'endMeters', typeof v === 'number' ? v : '')}
                        size="xs"
                        w={110}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}

        {errorMessage && (
          <Text size="sm" c="red">{errorMessage}</Text>
        )}

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => router.push(`/stations/${stationId}/platforms/${platformId}/stop-patterns`)}
          >
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
