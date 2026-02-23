import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { Container } from '@/components/ui/Container';

export default function NotFound() {
  return (
    <Container className="py-16 text-center">
      <SearchX size={48} className="text-gray-300 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-gray-800 mb-2">ページが見つかりません</h1>
      <p className="text-sm text-gray-500 mb-6">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg px-4 py-2 bg-white shadow-sm transition-colors"
      >
        <ArrowLeft size={15} />
        トップページに戻る
      </Link>
    </Container>
  );
}
