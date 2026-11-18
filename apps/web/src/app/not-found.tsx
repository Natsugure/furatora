import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { pillButtonSecondary } from '@/components/ui/pillButton';

const TITLE = 'ページが見つかりません';

// notFound() を呼んだページのタイトルもここで決まる（サイト名は layout.tsx の title.template が足す）
export const metadata: Metadata = { title: TITLE };

export default function NotFound() {
  return (
    <Container className="py-16 text-center">
      <SearchX size={48} aria-hidden className="text-line-strong mx-auto mb-4" />
      <h1 className="font-display text-2xl font-bold text-ink mb-2">{TITLE}</h1>
      <p className="text-sm text-muted mb-6">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link
        href="/"
        className={pillButtonSecondary}
      >
        <ArrowLeft size={15} />
        トップページに戻る
      </Link>
    </Container>
  );
}
