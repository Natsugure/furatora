'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
      alert('Failed to save');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">よみがな - Optional</label>
        <input
          type="text"
          value={nameKana}
          onChange={(e) => setNameKana(e.target.value)}
          placeholder="e.g. ぎんざせん"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Update'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/lines')}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
