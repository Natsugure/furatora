'use client';

import { useState } from 'react';
import { Button, Card, Group, Modal, Radio, Stack, Text } from '@mantine/core';
import { matchKey, type DuplicateChoice, type DuplicateMatch } from '../domain/duplicates';
import type { RouteDraft } from '../domain/types';

type Props = {
  opened: boolean;
  matches: DuplicateMatch[];
  /** ルート番号・名前の表示に使う、いまの下書きのカード */
  routes: RouteDraft[];
  onConfirm: (choices: Record<string, DuplicateChoice>) => void;
  onCancel: () => void;
};

// 保存時の重複候補の提示（docs/spec の決定2）。保存は止めない: 既定は「別ルートとして作る」で、
// 中身が同じでも別の物理経路でありうること（池袋の各線のエレベーター経由）を前提にする。
export function DuplicateRouteModal({ opened, matches, routes, onConfirm, onCancel }: Props) {
  const [choices, setChoices] = useState<Record<string, DuplicateChoice>>({});

  const describeRoute = (key: string) => {
    const index = routes.findIndex((r) => r.key === key);
    const route = routes[index];
    return `ルート ${index + 1}「${route?.label.trim() || '（名前なし）'}」`;
  };
  const choiceOf = (match: DuplicateMatch): DuplicateChoice => choices[matchKey(match)] ?? 'separate';

  return (
    <Modal opened={opened} onClose={onCancel} title="同じ内容のルートがあります" size="lg" centered>
      <Stack gap="md">
        <Text size="sm">
          通る設備の種類と経路の性質（屋外・改札外・係員・公式案内）が一致するルートがあります。
          同じ物理経路なら共有し、別の経路なら別ルートとして作ってください。中身が同じでも別の経路のことがあるため、
          既定は別ルートです。
        </Text>

        {matches.map((match) => {
          const key = matchKey(match);
          return (
            <Card key={key} withBorder padding="sm">
              <Radio.Group
                value={choiceOf(match)}
                onChange={(value) => setChoices((c) => ({ ...c, [key]: value as DuplicateChoice }))}
                label={
                  match.kind === 'candidate'
                    ? `${describeRoute(match.key)} は、${match.candidate.usedBy} の「${match.candidate.label}」と一致しています`
                    : `${describeRoute(match.key)} と ${describeRoute(match.otherKey)} は同じ内容です`
                }
              >
                <Stack gap="xs" mt="xs">
                  <Radio
                    value="share"
                    label={
                      match.kind === 'candidate'
                        ? '既存のルートを共有する（そのルートの編集は共有先にも反映されます）'
                        : '1つのルートに統合する（適用する方面の組み合わせは合算します）'
                    }
                  />
                  <Radio
                    value="separate"
                    label={match.kind === 'candidate' ? '別ルートとして作る' : '別ルートのままにする'}
                  />
                </Stack>
              </Radio.Group>
            </Card>
          );
        })}

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>キャンセル</Button>
          <Button
            onClick={() =>
              onConfirm(Object.fromEntries(matches.map((m) => [matchKey(m), choiceOf(m)])))
            }
          >
            選択を反映して保存
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
