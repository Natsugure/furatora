'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { CarStopPosition } from '@furatora/database/schema';
import {
  Button, Card, Group, NativeSelect, NumberInput, Stack, Text, TextInput, Textarea,
} from '@mantine/core';

type Line = { id: string; name: string };
type LineDirection = {
  id: string;
  directionType: string;
  displayName: string;
  representativeStationId: string;
};

type PlatformData = {
  id?: string;
  platformNumber: string;
  lineId: string;
  inboundDirectionId: string | null;
  outboundDirectionId: string | null;
  maxCarCount: number;
  carStopPositions: CarStopPosition[] | null;
  platformSide: string | null;
  notes: string;
};

type Props = {
  stationId: string;
  initialData?: PlatformData;
  isEdit?: boolean;
};

export function PlatformForm({ stationId, initialData, isEdit = false }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [directions, setDirections] = useState<LineDirection[]>([]);
  const [platformNumber, setPlatformNumber] = useState(initialData?.platformNumber ?? '');
  const [lineId, setLineId] = useState(initialData?.lineId ?? '');
  const [inboundDirectionId, setInboundDirectionId] = useState<string>(
    initialData?.inboundDirectionId ?? ''
  );
  const [outboundDirectionId, setOutboundDirectionId] = useState<string>(
    initialData?.outboundDirectionId ?? ''
  );
  const [maxCarCount, setMaxCarCount] = useState(initialData?.maxCarCount ?? 10);
  const [carStopPositions, setCarStopPositions] = useState<CarStopPosition[]>(
    initialData?.carStopPositions ?? []
  );
  const [platformSide, setPlatformSide] = useState<string>(
    initialData?.platformSide ?? ''
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/lines')
      .then((r) => r.json())
      .then(setLines);
  }, []);

  useEffect(() => {
    if (lineId) {
      fetch(`/api/lines/${lineId}/directions`)
        .then((r) => r.json())
        .then(setDirections);
    } else {
      setDirections([]);
    }
  }, [lineId]);

  function addStopPosition() {
    setCarStopPositions((prev) => [
      ...prev,
      { carCount: 8, referenceCarNumber: 1, referencePlatformCell: 1, direction: 'ascending' as const },
    ]);
  }
  function removeStopPosition(index: number) {
    setCarStopPositions((prev) => prev.filter((_, i) => i !== index));
  }
  function updateStopPositionNumber(index: number, field: 'carCount' | 'referenceCarNumber' | 'referencePlatformCell', value: number) {
    setCarStopPositions((prev) =>
      prev.map((sp, i) => (i === index ? { ...sp, [field]: value } : sp))
    );
  }
  function updateStopPositionDirection(index: number, value: 'ascending' | 'descending') {
    setCarStopPositions((prev) =>
      prev.map((sp, i) => (i === index ? { ...sp, direction: value } : sp))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      platformNumber,
      lineId,
      inboundDirectionId: inboundDirectionId || null,
      outboundDirectionId: outboundDirectionId || null,
      maxCarCount,
      carStopPositions: carStopPositions.length > 0 ? carStopPositions : null,
      platformSide: platformSide || null,
      notes: notes || null,
    };

    const url = isEdit
      ? `/api/stations/${stationId}/platforms/${initialData!.id}`
      : `/api/stations/${stationId}/platforms`;
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
      alert('Failed to save');
    }
  }

  const inboundDirections = directions.filter((d) => d.directionType === 'inbound');
  const outboundDirections = directions.filter((d) => d.directionType === 'outbound');

  const lineSelectData = [
    { value: '', label: 'Select line' },
    ...lines.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <TextInput
          label="Platform Number"
          placeholder="e.g. 1, 2a"
          value={platformNumber}
          onChange={(e) => setPlatformNumber(e.target.value)}
          required
          w={128}
        />

        <NativeSelect
          label="Line"
          data={lineSelectData}
          value={lineId}
          onChange={(e) => {
            setLineId(e.target.value);
            setInboundDirectionId('');
            setOutboundDirectionId('');
          }}
          required
        />

        {lineId && (
          <>
            <div>
              <NativeSelect
                label="Inbound Direction (上り方面) - Optional"
                data={[
                  { value: '', label: 'None' },
                  ...inboundDirections.map((d) => ({ value: d.id, label: d.displayName })),
                ]}
                value={inboundDirectionId}
                onChange={(e) => setInboundDirectionId(e.target.value)}
              />
              {inboundDirections.length === 0 && (
                <Text size="xs" c="dimmed" mt="xs">
                  No inbound directions defined for this line. Please create one first.
                </Text>
              )}
            </div>

            <div>
              <NativeSelect
                label="Outbound Direction (下り方面) - Optional"
                data={[
                  { value: '', label: 'None' },
                  ...outboundDirections.map((d) => ({ value: d.id, label: d.displayName })),
                ]}
                value={outboundDirectionId}
                onChange={(e) => setOutboundDirectionId(e.target.value)}
              />
              {outboundDirections.length === 0 && (
                <Text size="xs" c="dimmed" mt="xs">
                  No outbound directions defined for this line. Please create one first.
                </Text>
              )}
            </div>
          </>
        )}

        <NumberInput
          label="Maximum Car Count"
          min={1}
          value={maxCarCount}
          onChange={(v) => setMaxCarCount(typeof v === 'number' ? v : 10)}
          required
          w={128}
        />

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>Car Stop Positions</Text>
            <Button variant="subtle" size="compact-sm" onClick={addStopPosition}>
              + Add Position
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mb="xs">
            編成両数ごとに停車位置を定義します。基準号車とその停車枠番号、進行方向を指定してください。
          </Text>
          <Stack gap="xs">
            {carStopPositions.map((sp, i) => (
              <Card key={i} withBorder padding="sm" bg="gray.0">
                <Group gap="md" wrap="wrap" align="flex-end">
                  <NumberInput
                    label="編成両数"
                    min={1}
                    max={maxCarCount}
                    value={sp.carCount}
                    onChange={(v) => updateStopPositionNumber(i, 'carCount', typeof v === 'number' ? v : 1)}
                    w={80}
                    size="xs"
                    suffix="両"
                  />
                  <NumberInput
                    label="基準号車"
                    min={1}
                    max={sp.carCount}
                    value={sp.referenceCarNumber}
                    onChange={(v) => updateStopPositionNumber(i, 'referenceCarNumber', typeof v === 'number' ? v : 1)}
                    w={80}
                    size="xs"
                    suffix="号車"
                  />
                  <NumberInput
                    label="停車枠"
                    min={1}
                    max={maxCarCount}
                    value={sp.referencePlatformCell}
                    onChange={(v) => updateStopPositionNumber(i, 'referencePlatformCell', typeof v === 'number' ? v : 1)}
                    w={80}
                    size="xs"
                    suffix="番"
                  />
                  <NativeSelect
                    label="進行方向"
                    data={[
                      { value: 'ascending', label: 'ascending (1号車→小枠番号側)' },
                      { value: 'descending', label: 'descending (1号車→大枠番号側)' },
                    ]}
                    value={sp.direction}
                    onChange={(e) => updateStopPositionDirection(i, e.target.value as 'ascending' | 'descending')}
                    size="xs"
                  />
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-xs"
                    onClick={() => removeStopPosition(i)}
                  >
                    Remove
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        </div>

        <NativeSelect
          label="ホーム位置 (Platform Side)"
          description="可視化で列車図の上下どちらにホーム帯を表示するか"
          data={[
            { value: '', label: '未設定（デフォルト: 下）' },
            { value: 'bottom', label: 'bottom（列車の下側）' },
            { value: 'top', label: 'top（列車の上側）' },
          ]}
          value={platformSide}
          onChange={(e) => setPlatformSide(e.target.value)}
          w={256}
        />

        <Textarea
          label="Notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Update' : 'Create'}
          </Button>
          <Button variant="default" onClick={() => router.push(`/stations/${stationId}/facilities`)}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
