'use client';

import { AccordionChevron, ActionIcon, Button, Group, Title } from '@mantine/core';

type Props = {
  title: string;
  /** 新規・複製項目のみ渡す（保存前に取り消す。サーバーへは触らない） */
  onDiscard?: () => void;
  /** 既存項目のみ渡す（サーバーから削除する） */
  onDelete?: () => void;
  deleting?: boolean;
  /** 渡すとタイトル横に開閉ボタンを出す（未指定時は従来どおりの表示） */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

/** インスペクタ（ConcourseInspector/StopPatternInspector）共通のタイトル＋取り消す/削除ボタン */
export function InspectorHeader({
  title, onDiscard, onDelete, deleting, collapsed, onToggleCollapsed,
}: Props) {
  return (
    <Group justify="space-between" mb="md">
      <Group gap="xs">
        {onToggleCollapsed && (
          <ActionIcon
            type="button"
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={collapsed ? '展開する' : '折りたたむ'}
            onClick={onToggleCollapsed}
          >
            <AccordionChevron style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }} />
          </ActionIcon>
        )}
        <Title order={4}>{title}</Title>
      </Group>
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
