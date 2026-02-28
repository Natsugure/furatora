'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Group, Stack, TextInput } from '@mantine/core';

type Props = {
  lineId: string;
  initialData: {
    nameKana: string | null;
  };
};

export function LineForm({ lineId, initialData }: Props) {
  const router = useRouter();
  const [nameKana, setNameKana] = useState(initialData.nameKana ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch(`/api/lines/${lineId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameKana: nameKana || null }),
    });

    if (res.ok) {
      router.push('/lines');
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
          label="よみがな - 任意"
          placeholder="例: ぎんざせん"
          value={nameKana}
          onChange={(e) => setNameKana(e.target.value)}
        />
        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            更新
          </Button>
          <Button variant="default" onClick={() => router.push('/lines')}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
