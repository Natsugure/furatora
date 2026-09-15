'use client';

import { useState } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import type { LineWithDirections } from '@/features/platform/ports';
import { PlatformInspector } from './inspector/PlatformInspector';

type Props = {
  stationId: string;
  lines: LineWithDirections[];
};

/**
 * ホームが1件も登録されていない駅向けの導線。StationLayoutEditor 側の
 * 「+ ホームを追加」ボタンと同じ PlatformInspector（新規作成モード）を使う。
 * ホームが無い間は StationLayoutEditor 自体が描画されない（platform.id 前提の
 * props を要求するため）ので、この導線を StationLayoutView 側に用意する。
 */
export function NewPlatformPrompt({ stationId, lines }: Props) {
  const [creating, setCreating] = useState(false);

  return (
    <Stack gap="lg">
      <Group gap="xs" justify="space-between">
        <Text c="dimmed">ホームがまだ登録されていません。</Text>
        <Button variant="default" size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? 'キャンセル' : '+ ホームを追加'}
        </Button>
      </Group>

      {creating && (
        <PlatformInspector stationId={stationId} lines={lines} onCancel={() => setCreating(false)} />
      )}
    </Stack>
  );
}
