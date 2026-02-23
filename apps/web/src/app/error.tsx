'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Container } from '@/components/ui/Container';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    // エラー内容はサーバーログに記録されるため、ここでは何もしない
    void error;
  }, [error]);

  return (
    <Container className="py-16 text-center">
      <AlertTriangle size={48} className="text-amber-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-gray-800 mb-2">エラーが発生しました</h1>
      <p className="text-sm text-gray-500 mb-6">
        申し訳ありません。予期しないエラーが発生しました。
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg px-4 py-2 shadow-sm transition-colors"
        >
          再試行する
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg px-4 py-2 bg-white shadow-sm transition-colors"
        >
          <ArrowLeft size={15} />
          トップページに戻る
        </Link>
      </div>
    </Container>
  );
}
