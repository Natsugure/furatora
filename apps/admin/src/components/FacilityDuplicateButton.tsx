'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@mantine/core';

type Props = {
  endpoint: string;
};

export function FacilityDuplicateButton({ endpoint }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDuplicate() {
    setLoading(true);
    const res = await fetch(endpoint, { method: 'POST' });
    if (res.ok) {
      router.refresh();
    } else {
      alert('複製に失敗しました');
    }
    setLoading(false);
  }

  return (
    <Button
      variant="default"
      size="compact-sm"
      loading={loading}
      onClick={handleDuplicate}
    >
      複製
    </Button>
  );
}
