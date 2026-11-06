'use client';

import { useMemo, useState } from 'react';
import {
  Button, Card, Collapse, Group, NativeSelect, NumberInput, Radio, Stack, Text, Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { CarNumbersAscendToward } from '@furatora/platform-diagram/domain';
import {
  ascendTowardOf, buildCarSegments, type CarNumberOrder, type CarSegment,
} from '@/features/stop-pattern/domain/carSegments';
import type { TrainOptionDTO } from '@/features/stop-pattern/domain/types';
import { freeEdgeSides } from '@/features/station-layout/domain/editDraft';
import { InspectorHeader } from './InspectorHeader';

type PatternCar = { carNumber: number; startMeters: number; endMeters: number };

type CreateProps = {
  trains: TrainOptionDTO[];
  /** 既にこのホームに停車パターンを持つ列車ID（選択肢から除外して409を未然に防ぐ） */
  excludeTrainIds: string[];
  onPreview: (trainId: string, segments: CarSegment[], ascendToward: CarNumbersAscendToward) => void;
  onCancel: () => void;
};

/**
 * 新規停車パターン作成の入口（US-3）。列車選択＋編成基準位置入力で
 * buildCarSegments() のプレビューを作る。プレビュー後の位置の調整は
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
    onPreview(trainId, segments, ascendTowardOf(order));
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
  ascendToward: CarNumbersAscendToward;
  onShiftConsist: (edge: { carNumber: number; side: 'start' | 'end' }, x: number) => void;
  /** 号車番号の向きを反転する。編成が占める区間は保つ（editDraft.ts の reverseConsist） */
  onReverse: () => void;
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
 * 停車位置を数値入力で調整するインスペクタ。編成の先頭・末尾のどちらを入れても
 * 編成全体が動く。図上ドラッグ（DiagramEditLayer）と同じ onShiftConsist を呼ぶため、
 * 動かし方は editDraft.ts の shiftConsistByEdge 1箇所に閉じる。号車番号の向きの反転
 * （onReverse → reverseConsist）は、編成が占める区間を保ったまま号車の並びだけを逆にする。
 * 号車の長さは列車の号車構成で決まり、ここでは変えない（ADR-0025）。
 */
export function StopPatternInspector({
  trainLabel, cars, ascendToward, onShiftConsist, onReverse, onSave, onDelete, onDiscard, saving, deleting, isNew,
}: EditProps) {
  const sorted = useMemo(() => [...cars].sort((a, b) => a.carNumber - b.carNumber), [cars]);
  const reversed = ascendToward === 'minusX';
  // 号車構成から算出した区間なので、1号車と最終号車は必ずある
  const firstCar = sorted[0]!;
  const lastCar = sorted[sorted.length - 1]!;
  // 新規（未保存）パターンは作成直後に内容を確認・調整したいはずなので展開。
  // 既存パターンは一覧性を優先しデフォルト折りたたみ
  const [collapsed, { toggle: toggleCollapsed }] = useDisclosure(!isNew);

  const { first: leadEdgeSide, last: trailEdgeSide } = freeEdgeSides(reversed);

  return (
    <Card withBorder padding="lg">
      <InspectorHeader
        title={isNew ? `${trainLabel} の停車位置（新規）` : `${trainLabel} の停車位置を編集`}
        onDiscard={onDiscard}
        onDelete={onDelete}
        deleting={deleting}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      <Collapse in={!collapsed} transitionDuration={0}>
        <Stack gap="xs" maw="28rem">
          <NumberInput
            label={`${firstCar.carNumber}号車の先頭`}
            step={0.1}
            decimalScale={2}
            value={reversed ? firstCar.endMeters : firstCar.startMeters}
            onChange={(v) => typeof v === 'number' && onShiftConsist({ carNumber: firstCar.carNumber, side: leadEdgeSide }, v)}
            suffix=" m"
            size="sm"
          />
          <NumberInput
            label={`${lastCar.carNumber}号車の末尾`}
            step={0.1}
            decimalScale={2}
            value={reversed ? lastCar.startMeters : lastCar.endMeters}
            onChange={(v) => typeof v === 'number' && onShiftConsist({ carNumber: lastCar.carNumber, side: trailEdgeSide }, v)}
            suffix=" m"
            size="sm"
          />
          <Group gap="xs" mt={4}>
            <Button type="button" variant="default" size="xs" onClick={onReverse}>号車の向きを反転</Button>
            <Text size="xs" c="dimmed">編成の位置はそのままで、1号車が反対側の端に移ります</Text>
          </Group>
          <Text size="xs" c="dimmed">
            先頭・末尾のどちらを変えても編成全体が動きます。号車の長さは列車の号車構成で決まるので、変えるときは列車の編集画面で直してください
          </Text>
        </Stack>

        <Group gap="sm" mt="lg">
          <Button type="button" loading={saving} onClick={onSave}>保存</Button>
        </Group>
      </Collapse>
    </Card>
  );
}
