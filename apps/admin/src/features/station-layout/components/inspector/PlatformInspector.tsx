'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button, Card, Group, NativeSelect, NumberInput, Stack, Text, TextInput, Textarea, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { LineWithDirections } from '@/features/platform/ports';
import { describeError } from '@/features/station-publishing/describeError';
import type { ListHrefState } from '@/shared/list/href';
import { stationLayoutHref } from '@/features/station/listState';

type PlatformData = {
  id: string;
  platformNumber: string;
  lineId: string;
  inboundDirectionId: string | null;
  outboundDirectionId: string | null;
  physicalLength: number;
  platformSide: string | null;
  notes: string | null;
};

type Props = {
  stationId: string;
  lines: LineWithDirections[];
  /** 既存ホームの編集なら渡す。省略時は新規作成 */
  initialData?: PlatformData;
  onCancel: () => void;
  /** 一覧から遷移してきた際の絞り込み状態。保存後の遷移先URLに載せて保持する */
  listState: ListHrefState;
};

/**
 * ホーム基本情報のテキストフォーム。
 *
 * 座標ドラッグと違って即時プレビューが要らない（物理長はホーム全体の描画範囲に
 * 影響するため保存を待って router.refresh() で反映するのが自然）ため、
 * StationLayoutEditor の draft/dirty 機構には参加せず、自前で fetch する
 * 独立したミニフォームとして実装する。
 */
export function PlatformInspector({ stationId, lines, initialData, onCancel, listState }: Props) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [platformNumber, setPlatformNumber] = useState(initialData?.platformNumber ?? '');
  // 路線自動設定（#32①）: この駅に紐づく路線が1件のみならそれを既定値にする。
  // 複数候補がある場合は選択を求める（自動設定できない場合のフォールバック）
  const [lineId, setLineId] = useState(initialData?.lineId ?? (lines.length === 1 ? lines[0]!.id : ''));
  const [inboundDirectionId, setInboundDirectionId] = useState(initialData?.inboundDirectionId ?? '');
  const [outboundDirectionId, setOutboundDirectionId] = useState(initialData?.outboundDirectionId ?? '');
  const [physicalLength, setPhysicalLength] = useState(initialData?.physicalLength ?? 0);
  const [platformSide, setPlatformSide] = useState(initialData?.platformSide ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (physicalLength <= 0) {
      notifications.show({ title: '入力エラー', message: 'ホーム長は0より大きい値を入力してください', color: 'red' });
      return;
    }
    if (!lineId) {
      notifications.show({ title: '入力エラー', message: '路線を選択してください', color: 'red' });
      return;
    }

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
    setSubmitting(false);

    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      notifications.show({ title: '保存に失敗しました', message: describeError(body), color: 'red' });
      return;
    }

    const saved: unknown = await res.json().catch(() => null);
    const savedId = isEdit ? initialData!.id : (saved as { id?: string } | null)?.id;
    notifications.show({ title: '保存しました', message: isEdit ? 'ホーム情報を更新しました' : '新しいホームを追加しました', color: 'green' });
    onCancel();
    if (savedId) {
      router.push(stationLayoutHref(stationId, listState, { platformId: savedId }));
    }
    router.refresh();
  }

  const inboundDirections = lines.find((l) => l.id === lineId)?.inboundDirections ?? [];
  const outboundDirections = lines.find((l) => l.id === lineId)?.outboundDirections ?? [];
  const lineSelectData = [
    { value: '', label: '路線を選択' },
    ...lines.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="md">{isEdit ? 'ホーム情報を編集' : '新しいホームを追加'}</Title>
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

          <div>
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
            {lines.length === 0 && (
              <Text size="xs" c="dimmed" mt={4}>
                この駅に紐づく路線が登録されていません。先に駅と路線の対応を登録してください。
              </Text>
            )}
            {!isEdit && lines.length === 1 && (
              <Text size="xs" c="dimmed" mt={4}>
                この駅唯一の路線を自動設定しました。
              </Text>
            )}
          </div>

          {lineId && (
            <>
              <NativeSelect
                label="上り方面（任意）"
                data={[{ value: '', label: 'なし' }, ...inboundDirections.map((d) => ({ value: d.id, label: d.displayName }))]}
                value={inboundDirectionId}
                onChange={(e) => setInboundDirectionId(e.target.value)}
              />
              <NativeSelect
                label="下り方面（任意）"
                data={[{ value: '', label: 'なし' }, ...outboundDirections.map((d) => ({ value: d.id, label: d.displayName }))]}
                value={outboundDirectionId}
                onChange={(e) => setOutboundDirectionId(e.target.value)}
              />
            </>
          )}

          <NumberInput
            label="ホームの物理長"
            description="メートル単位。ホームの実体は 0 からこの値までの区間として扱われます。"
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

          <Textarea label="備考" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

          <Group gap="sm">
            <Button type="submit" loading={submitting}>{isEdit ? '更新' : '追加'}</Button>
            <Button type="button" variant="default" onClick={onCancel}>キャンセル</Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
