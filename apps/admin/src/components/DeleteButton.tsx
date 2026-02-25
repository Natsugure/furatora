'use client';

import { useRouter } from 'next/navigation';

type Props = {
  endpoint: string;
  redirectTo: string;
  label?: string;
};

export function DeleteButton({ endpoint, redirectTo, label = 'Delete' }: Props) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this item?')) return;
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (res.ok) {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
    >
      {label}
    </button>
  );
}
