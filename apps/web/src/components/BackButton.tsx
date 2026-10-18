'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

type Props = {
  /** 渡すと、その行き先へのリンクにする。省略すると前の画面に戻る */
  href?: string;
};

const className =
  'size-11 inline-flex items-center justify-center rounded-full bg-surface text-ink-soft shadow-raised hover:text-brand-700 transition-colors mb-5';

export function BackButton({ href }: Props) {
  const router = useRouter();
  const icon = <ChevronLeft size={20} strokeWidth={2.2} aria-hidden />;

  if (href) {
    return (
      <Link href={href} aria-label="戻る" className={className}>
        {icon}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => router.back()} aria-label="戻る" className={className}>
      {icon}
    </button>
  );
}
