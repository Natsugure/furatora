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
    // サーバーコンポーネント由来のエラーは Next.js がサーバー側で自動記録する。
    // クライアントコンポーネント由来のエラーは現状ここでは収集していない。
    // 将来的に Sentry 等を導入する場合はここで captureException を呼び出す。
    void error;
  }, [error]);

  return (
    <Container className="py-16 text-center">
      <AlertTriangle size={48} aria-hidden className="text-brand-400 mx-auto mb-4" />
      <h1 className="font-display text-2xl font-bold text-ink mb-2">エラーが発生しました</h1>
      <p className="text-sm text-muted mb-6">
        申し訳ありません。予期しないエラーが発生しました。
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="h-11 px-5 rounded-full bg-brand-600 hover:bg-brand-700 text-sm font-bold text-white transition-colors"
        >
          再試行する
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-surface shadow-raised text-sm font-bold text-brand-600 hover:text-brand-700 transition-colors"
        >
          <ArrowLeft size={15} />
          トップページに戻る
        </Link>
      </div>
    </Container>
  );
}
