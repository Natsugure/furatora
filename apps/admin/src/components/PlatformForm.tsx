'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Button, Group, Loader, NativeSelect, NumberInput, Stack, Text, TextInput, Textarea,
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
  physicalLength: number;
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
  const [physicalLength, setPhysicalLength] = useState(initialData?.physicalLength ?? 0);
  const [platformSide, setPlatformSide] = useState<string>(
    initialData?.platformSide ?? ''
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [linesLoading, setLinesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/lines')
      .then((r) => r.json())
      .then((data) => {
        setLines(data);
        setLinesLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!lineId) {
      Promise.resolve().then(() => setDirections([]));
      return;
    }
    fetch(`/api/lines/${lineId}/directions`)
      .then((r) => r.json())
      .then(setDirections);
  }, [lineId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      platformNumber,
      lineId,
      inboundDirectionId: inboundDirectionId || null,
      outboundDirectionId: outboundDirectionId || null,
      physicalLength,
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
      alert('保存に失敗しました');
    }
  }

  const inboundDirections = directions.filter((d) => d.directionType === 'inbound');
  const outboundDirections = directions.filter((d) => d.directionType === 'outbound');

  const lineSelectData = [
    { value: '', label: '路線を選択' },
    ...lines.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <TextInput
          label="ホーム番号"
          placeholder="例: 1, 2a"
          value={platformNumber}
          onChange={(e) => setPlatformNumber(e.target.value)}
          required
          w={{ base: '100%', xs: 128 }}
        />

        {linesLoading ? (
          <Group gap="xs" align="center">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">路線を読み込み中...</Text>
          </Group>
        ) : (
          <NativeSelect
            label="路線"
            data={lineSelectData}
            value={lineId}
            onChange={(e) => {
              setLineId(e.target.value);
              setInboundDirectionId('');
              setOutboundDirectionId('');
            }}
            required
          />
        )}

        {lineId && (
          <>
            <div>
              <NativeSelect
                label="上り方面（任意）"
                data={[
                  { value: '', label: 'なし' },
                  ...inboundDirections.map((d) => ({ value: d.id, label: d.displayName })),
                ]}
                value={inboundDirectionId}
                onChange={(e) => setInboundDirectionId(e.target.value)}
              />
              {inboundDirections.length === 0 && (
                <Text size="xs" c="dimmed" mt="xs">
                  この路線に上り方面が定義されていません。先に作成してください。
                </Text>
              )}
            </div>

            <div>
              <NativeSelect
                label="下り方面（任意）"
                data={[
                  { value: '', label: 'なし' },
                  ...outboundDirections.map((d) => ({ value: d.id, label: d.displayName })),
                ]}
                value={outboundDirectionId}
                onChange={(e) => setOutboundDirectionId(e.target.value)}
              />
              {outboundDirections.length === 0 && (
                <Text size="xs" c="dimmed" mt="xs">
                  この路線に下り方面が定義されていません。先に作成してください。
                </Text>
              )}
            </div>
          </>
        )}

        <NumberInput
          label="ホームの物理長"
          description="メートル単位。ホームの実体は 0 からこの値までの区間として扱われます"
          min={0}
          step={0.1}
          decimalScale={2}
          suffix=" m"
          value={physicalLength}
          onChange={(v) => setPhysicalLength(typeof v === 'number' ? v : 0)}
          required
          w={{ base: '100%', xs: 160 }}
        />

        <NativeSelect
          label="ホーム位置"
          description="可視化で列車図の上下どちらにホーム帯を表示するか"
          data={[
            { value: '', label: '未設定（デフォルト: 下）' },
            { value: 'bottom', label: 'bottom（列車の下側）' },
            { value: 'top', label: 'top（列車の上側）' },
          ]}
          value={platformSide}
          onChange={(e) => setPlatformSide(e.target.value)}
          w={{ base: '100%', sm: 256 }}
        />

        <Textarea
          label="備考"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

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
