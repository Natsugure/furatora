'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
    <button
      onClick={handleDuplicate}
      disabled={loading}
      className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
    >
      {loading ? '...' : 'Duplicate'}
    </button>
  );
}
