'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { pillButtonPrimary, pillButtonSecondary } from '@/components/ui/pillButton';

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
          className={pillButtonPrimary}
        >
          再試行する
        </button>
        <Link
          href="/"
          className={pillButtonSecondary}
        >
          <ArrowLeft size={15} />
          トップページに戻る
        </Link>
      </div>
    </Container>
  );
}
