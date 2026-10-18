'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="戻る"
      className="size-11 inline-flex items-center justify-center rounded-full bg-surface text-ink-soft shadow-raised hover:text-brand-700 transition-colors mb-5"
    >
      <ChevronLeft size={20} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
