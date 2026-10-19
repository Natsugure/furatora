'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

type Props = {
  /** アプリ内の履歴が無いとき（共有されたリンクを直接開いたときなど）の行き先 */
  href: string;
};

// Navigation API（TypeScript 5.9 の lib.dom にまだ型が無い）。使う所だけ書く
type WindowWithNavigation = Window & { navigation?: { canGoBack: boolean } };

const className =
  'size-11 inline-flex items-center justify-center rounded-full bg-surface text-ink-soft shadow-raised hover:text-brand-700 transition-colors mb-5';

// 前の画面に戻る。アプリ内の履歴が無ければ href へ行く。
// history.length はサイトの外の履歴も数えるため使えない。navigation.canGoBack は同じオリジンの履歴だけを見る。
// Navigation API の無いブラウザと JavaScript の無い環境では、常に href へのリンクとして働く
export function BackButton({ href }: Props) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!(window as WindowWithNavigation).navigation?.canGoBack) return;
    e.preventDefault();
    router.back();
  };

  return (
    <Link href={href} onClick={handleClick} aria-label="戻る" className={className}>
      <ChevronLeft size={20} strokeWidth={2.2} aria-hidden />
    </Link>
  );
}
