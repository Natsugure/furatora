'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, Modal, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

type Props = {
  trainId: string;
  trainName: string;
};

export function DuplicateButton({ trainId, trainName }: Props) {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleOpen() {
    setNewName(`${trainName} (Copy)`);
    setError('');
    open();
  }

  async function handleDuplicate() {
    if (!newName.trim()) {
      setError('名前を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch(`/api/trains/${trainId}`);
    if (!res.ok) {
      setError('列車データの取得に失敗しました');
      setLoading(false);
      return;
    }

    const original = await res.json();

    const createRes = await fetch('/api/trains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        operatorId: original.operators,
        lineIds: original.lines,
        carCount: original.carCount,
        carStructure: original.carStructure,
        freeSpaces: original.freeSpaces,
        prioritySeats: original.prioritySeats,
      }),
    });

    if (createRes.ok) {
      close();
      router.refresh();
    } else {
      setError('複製に失敗しました');
    }
    setLoading(false);
  }

  return (
    <>
      <Button variant="default" size="compact-sm" onClick={handleOpen}>
        Duplicate
      </Button>
      <Modal opened={opened} onClose={close} title="列車を複製" centered>
        <TextInput
          label="新しい列車名"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          error={error}
          mb="lg"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>キャンセル</Button>
          <Button loading={loading} onClick={handleDuplicate}>複製</Button>
        </Group>
      </Modal>
    </>
  );
}
