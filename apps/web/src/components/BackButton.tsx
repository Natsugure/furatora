'use client';

import { useRouter } from 'next/navigation';

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
    >
      ← 戻る
    </button>
  );
}
