'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Group, Stack, Textarea } from '@mantine/core';

type Props = {
  stationId: string;
  initialNotes: string;
};

export function StationNotesForm({ stationId, initialNotes }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/stations/${stationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notes || null }),
    });
    if (res.ok) {
      router.push('/stations');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md" maw="42rem">
        <Textarea
          label="備考"
          placeholder="例: 東急東横線との直通運転あり"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            保存
          </Button>
          <Button variant="default" onClick={() => router.push('/stations')}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
