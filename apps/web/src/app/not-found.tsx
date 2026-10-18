import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { Container } from '@/components/ui/Container';

export default function NotFound() {
  return (
    <Container className="py-16 text-center">
      <SearchX size={48} aria-hidden className="text-line-strong mx-auto mb-4" />
      <h1 className="font-display text-2xl font-bold text-ink mb-2">ページが見つかりません</h1>
      <p className="text-sm text-muted mb-6">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-surface shadow-raised text-sm font-bold text-brand-600 hover:text-brand-700 transition-colors"
      >
        <ArrowLeft size={15} />
        トップページに戻る
      </Link>
    </Container>
  );
}
