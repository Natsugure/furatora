'use client';

import { Button, Group, Title } from '@mantine/core';

type Props = {
  title: string;
  /** 新規・複製項目のみ渡す（保存前に取り消す。サーバーへは触らない） */
  onDiscard?: () => void;
  /** 既存項目のみ渡す（サーバーから削除する） */
  onDelete?: () => void;
  deleting?: boolean;
};

/** インスペクタ（ConcourseInspector/StopPatternInspector）共通のタイトル＋取り消す/削除ボタン */
export function InspectorHeader({ title, onDiscard, onDelete, deleting }: Props) {
  return (
    <Group justify="space-between" mb="md">
      <Title order={4}>{title}</Title>
      <Group gap="xs">
        {onDiscard && (
          <Button type="button" variant="subtle" color="red" size="compact-sm" onClick={onDiscard}>
            取り消す
          </Button>
        )}
        {onDelete && (
          <Button type="button" variant="subtle" color="red" size="compact-sm" loading={deleting} onClick={onDelete}>
            削除
          </Button>
        )}
      </Group>
    </Group>
  );
}
