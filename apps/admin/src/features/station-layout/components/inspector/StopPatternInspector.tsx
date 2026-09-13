'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  Button, Card, Group, NativeSelect, NumberInput, Radio, Stack, Text, Title,
} from '@mantine/core';
import { isDoorOrderReversed } from '@furatora/platform-diagram/domain';
import { buildCarSegments, type CarNumberOrder, type CarSegment } from '@/features/stop-pattern/domain/carSegments';
import type { TrainOptionDTO } from '@/features/stop-pattern/domain/types';
import { freeEdgeSides } from '@/features/station-layout/domain/editDraft';
import { InspectorHeader } from './InspectorHeader';

type PatternCar = { carNumber: number; startMeters: number; endMeters: number };

type CreateProps = {
  trains: TrainOptionDTO[];
  /** 既にこのホームに停車パターンを持つ列車ID（選択肢から除外して409を未然に防ぐ） */
  excludeTrainIds: string[];
  onPreview: (trainId: string, segments: CarSegment[]) => void;
  onCancel: () => void;
};

/**
 * 新規停車パターン作成の入口（US-3）。列車選択＋編成基準位置入力で
 * buildCarSegments() のプレビューを作る。プレビュー後の境界調整は
 * StopPatternInspector（本ファイル下部）が担当する。
 */
export function StopPatternCreateForm({ trains, excludeTrainIds, onPreview, onCancel }: CreateProps) {
  const [trainId, setTrainId] = useState('');
  const [boundaryMeters, setBoundaryMeters] = useState<number | ''>(0);
  const [order, setOrder] = useState<CarNumberOrder>('carOneNearest');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableTrains = trains.filter((t) => !excludeTrainIds.includes(t.id));
  const selectedTrain = availableTrains.find((t) => t.id === trainId);

  function handlePreview() {
    if (!selectedTrain) {
      setErrorMessage('列車を選択してください');
      return;
    }
    setErrorMessage(null);
    const segments = buildCarSegments(selectedTrain.cars, typeof boundaryMeters === 'number' ? boundaryMeters : 0, order);
    onPreview(trainId, segments);
  }

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="md">停車位置を追加</Title>
      <Stack gap="lg" maw="42rem">
        <NativeSelect
          label="列車"
          data={[
            { value: '', label: '列車を選択' },
            ...availableTrains.map((t) => ({ value: t.id, label: `${t.name}（${t.carCount}両）` })),
          ]}
          value={trainId}
          onChange={(e) => setTrainId(e.target.value)}
          required
        />
        {availableTrains.length === 0 && (
          <Text size="xs" c="dimmed">このホームに登録できる列車がありません（全列車が登録済みです）</Text>
        )}

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

        <Radio.Group label="号車番号の向き" value={order} onChange={(v) => setOrder(v as CarNumberOrder)}>
          <Stack gap="xs" mt="xs">
            <Radio value="carOneNearest" label="x=0 に近い側が 1号車（号車番号が増えるほど x が大きくなる）" />
            <Radio value="lastCarNearest" label="x=0 に近い側が 最終号車（号車番号が増えるほど x が小さくなる）" />
          </Stack>
        </Radio.Group>

        {errorMessage && <Text size="sm" c="red">{errorMessage}</Text>}

        <Group gap="sm">
          <Button type="button" onClick={handlePreview} disabled={!trainId}>自動計算してプレビュー</Button>
          <Button type="button" variant="default" onClick={onCancel}>キャンセル</Button>
        </Group>
      </Stack>
    </Card>
  );
}

type EditProps = {
  trainLabel: string;
  cars: PatternCar[];
  onMoveCarBoundary: (boundaryIndex: number, x: number) => void;
  onMoveCarEdge: (edge: { carNumber: number; side: 'start' | 'end' }, x: number) => void;
  onSave: () => void;
  /** 既存パターンのみ渡す */
  onDelete?: () => void;
  /** 新規（未保存）パターンのみ渡す */
  onDiscard?: () => void;
  saving: boolean;
  deleting?: boolean;
  isNew: boolean;
};

/**
 * 号車境界を境界ベースの数値入力で調整するインスペクタ。図上ドラッグ
 * （DiagramEditLayer）と同じ onMoveCarBoundary/onMoveCarEdge を呼ぶため、
 * 隣接号車の連動・向き判定（isDoorOrderReversed）を含む隙間・重なり防止の
 * 不変条件は editDraft.ts の実装1箇所に閉じたまま、入力経路だけが増える。
 */
export function StopPatternInspector({
  trainLabel, cars, onMoveCarBoundary, onMoveCarEdge, onSave, onDelete, onDiscard, saving, deleting, isNew,
}: EditProps) {
  const sorted = useMemo(() => [...cars].sort((a, b) => a.carNumber - b.carNumber), [cars]);
  const reversed = useMemo(() => isDoorOrderReversed(sorted), [sorted]);

  const { first: leadEdgeSide, last: trailEdgeSide } = freeEdgeSides(reversed);

  return (
    <Card withBorder padding="lg">
      <InspectorHeader
        title={isNew ? `${trainLabel} の停車位置（新規）` : `${trainLabel} の停車位置を編集`}
        onDiscard={onDiscard}
        onDelete={onDelete}
        deleting={deleting}
      />

      <Stack gap={4} maw="28rem">
        {sorted.map((car, i) => {
          const isFirst = i === 0;
          const isLast = i === sorted.length - 1;
          const leadEdgeX = reversed ? car.endMeters : car.startMeters;
          const boundaryX = reversed ? car.startMeters : car.endMeters;
          const trailEdgeX = reversed ? car.startMeters : car.endMeters;

          return (
            <Fragment key={car.carNumber}>
              {isFirst && (
                <NumberInput
                  label={`${car.carNumber}号車の先頭`}
                  step={0.1}
                  decimalScale={2}
                  value={leadEdgeX}
                  onChange={(v) => typeof v === 'number' && onMoveCarEdge({ carNumber: car.carNumber, side: leadEdgeSide }, v)}
                  suffix=" m"
                  size="sm"
                />
              )}
              <Text size="xs" c="dimmed" ta="center">
                {car.carNumber}号車（{car.startMeters}m 〜 {car.endMeters}m）
              </Text>
              {!isLast ? (
                <NumberInput
                  label={`${car.carNumber}号車と${car.carNumber + 1}号車の境界`}
                  step={0.1}
                  decimalScale={2}
                  value={boundaryX}
                  onChange={(v) => typeof v === 'number' && onMoveCarBoundary(i, v)}
                  suffix=" m"
                  size="sm"
                />
              ) : (
                <NumberInput
                  label={`${car.carNumber}号車の末尾`}
                  step={0.1}
                  decimalScale={2}
                  value={trailEdgeX}
                  onChange={(v) => typeof v === 'number' && onMoveCarEdge({ carNumber: car.carNumber, side: trailEdgeSide }, v)}
                  suffix=" m"
                  size="sm"
                />
              )}
            </Fragment>
          );
        })}
      </Stack>

      <Group gap="sm" mt="lg">
        <Button type="button" loading={saving} onClick={onSave}>保存</Button>
      </Group>
    </Card>
  );
}
