'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Alert, Button, Checkbox, Group, NativeSelect,
  Stack, Text, TextInput, Textarea,
} from '@mantine/core';
import type { DirectionType } from '@furatora/database/enums';
import { FALLBACK_DIRECTION_LABELS } from '@furatora/transfer-difficulty/domain';
import type { LineDirectionEditContext } from '@/features/line/ports';
import { DIRECTIONS } from '@/features/transfer-connection/domain/types';
import { describeError } from '@/features/station-publishing/describeError';

type LineDirectionData = {
  id?: string;
  directionType: DirectionType;
  displayName: string;
  displayNameEn: string;
  notes: string;
  isDefault: boolean;
};

type Props = {
  lineId: string;
  initialData?: LineDirectionData;
  isEdit?: boolean;
  currentDefaults: LineDirectionEditContext['currentDefaults'];
};

const isDirectionType = (value: string): value is DirectionType =>
  (DIRECTIONS as readonly string[]).includes(value);

export function LineDirectionForm({ lineId, initialData, isEdit = false, currentDefaults }: Props) {
  const router = useRouter();
  const [directionType, setDirectionType] = useState<DirectionType>(initialData?.directionType ?? 'inbound');
  // 新規作成で、その組に既定行がまだ無ければ既定にしておく（ADR-0014。無いと「上り」「下り」で表示される）
  const hasNoDefault = (type: DirectionType) => currentDefaults[type] === null;
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? hasNoDefault(directionType));
  // 利用者がチェックを触ったあとは、方面タイプを切り替えても初期値を上書きしない
  const [isDefaultTouched, setIsDefaultTouched] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(initialData?.displayName ?? '');
  const [displayNameEn, setDisplayNameEn] = useState(initialData?.displayNameEn ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  function changeDirectionType(value: string) {
    if (!isDirectionType(value)) return;
    setDirectionType(value);
    if (!isDefaultTouched) setIsDefault(hasNoDefault(value));
  }

  // 選んだ組に自分以外の既定行があるなら、保存でそれが置き換わることを示す
  const otherDefault = currentDefaults[directionType];
  const replacedDefault = otherDefault && otherDefault.id !== initialData?.id ? otherDefault : null;
  // 既定行のチェックを外すか方面タイプを変えると、元の組は既定行を失い「上り」「下り」で表示される
  const lostDefaultType = initialData?.isDefault && (!isDefault || directionType !== initialData.directionType)
    ? initialData.directionType
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      directionType,
      displayName,
      displayNameEn: displayNameEn || null,
      notes: notes || null,
      isDefault,
    };

    const url = isEdit
      ? `/api/lines/${lineId}/directions/${initialData!.id}`
      : `/api/lines/${lineId}/directions`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(`/lines/${lineId}/directions`);
      router.refresh();
    } else {
      setSubmitting(false);
      // 409（同じ組の既定の同時変更）を含め、API のメッセージを表示する
      const body: unknown = await res.json().catch(() => null);
      setError(describeError(body));
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <NativeSelect
          label="方面タイプ"
          data={DIRECTIONS.map((type) => ({ value: type, label: FALLBACK_DIRECTION_LABELS[type] }))}
          value={directionType}
          onChange={(e) => changeDirectionType(e.target.value)}
          required
        />

        <TextInput
          label="表示名（日本語）"
          placeholder="例: 渋谷方面"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />

        <TextInput
          label="表示名（英語）- 任意"
          placeholder="e.g. For Shibuya"
          value={displayNameEn}
          onChange={(e) => setDisplayNameEn(e.target.value)}
        />

        <div>
          <Checkbox
            label="この路線・方面の既定の表示名にする"
            description="ホームが登録されていない駅で、乗換案内の方面名として使われます。途中の駅名を含まない、終点方向の文言を選んでください"
            checked={isDefault}
            onChange={(e) => {
              setIsDefault(e.currentTarget.checked);
              setIsDefaultTouched(true);
            }}
          />
          {isDefault && replacedDefault && (
            <Text size="xs" c="orange" mt={4} ml={32}>
              現在の既定: {replacedDefault.displayName}（保存すると置き換わります）
            </Text>
          )}
          {lostDefaultType && (
            <Text size="xs" c="orange" mt={4} ml={32}>
              保存すると、{FALLBACK_DIRECTION_LABELS[lostDefaultType]}の既定の表示名が無くなります
              （ホームが未登録の駅では「{FALLBACK_DIRECTION_LABELS[lostDefaultType]}」と表示されます）
            </Text>
          )}
        </div>

        <Textarea
          label="備考"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button variant="default" onClick={() => router.push(`/lines/${lineId}/directions`)}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
