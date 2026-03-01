'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Group, NumberInput, Stack, TextInput } from '@mantine/core';

type Props = {
  operatorId?: string;
  initialData?: {
    name: string;
    odptOperatorId: string | null;
    displayPriority: number | null;
  };
};

export function OperatorForm({ operatorId, initialData }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? '');
  const [odptOperatorId, setOdptOperatorId] = useState(initialData?.odptOperatorId ?? '');
  const [displayPriority, setDisplayPriority] = useState<number | string>(
    initialData?.displayPriority ?? ''
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const url = operatorId ? `/api/operators/${operatorId}` : '/api/operators';
    const method = operatorId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        odptOperatorId: odptOperatorId || null,
        displayPriority: typeof displayPriority === 'number' ? displayPriority : null,
      }),
    });

    if (res.ok) {
      router.push('/operators');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <TextInput
          label="事業者名"
          placeholder="例: 東京メトロ"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          label="ODPT事業者コード - 任意"
          placeholder="例: odpt.Operator:TokyoMetro"
          value={odptOperatorId}
          onChange={(e) => setOdptOperatorId(e.target.value)}
        />
        <NumberInput
          label="表示優先度 - 任意"
          placeholder="未設定の場合は非表示"
          value={displayPriority}
          onChange={setDisplayPriority}
        />
        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {operatorId ? '更新' : '作成'}
          </Button>
          <Button variant="default" onClick={() => router.push('/operators')}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
