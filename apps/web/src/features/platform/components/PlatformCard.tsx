'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { ChevronDown } from 'lucide-react';

type Props = {
  title: string;
  badge: ReactNode;
  // 頭の2行目以降（路線・編成・方面など）。開け閉めボタンの名前には含めない
  details: ReactNode;
  // false なら開け閉めの操作を出さず、中身も出さない（カードに出すものが頭しか無い番線）
  collapsible: boolean;
  children?: ReactNode;
};

// 番線のカード。lg 未満では折りたたみ（既定で閉じる）、lg 以上ではいつも開いている（ADR-0023）。
//
// 見た目の切り替えは CSS（lg:）だけで行う。useMediaQuery で見た目を決めると、最初の描画（サーバー）が
// 必ずスマホの形になり、PC で一瞬閉じて見える。
// ただし CSS だけだと、PC では中身が見えているのに頭が「折りたたまれたボタン」と読み上げられ、押しても何も
// 変わらない。支援技術向けに、lg 以上では頭をボタンにしない（ここだけ useMediaQuery を使う。見た目は変わらない）
export function PlatformCard({ title, badge, details, collapsible, children }: Props) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 64em)');
  const contentId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  const interactive = collapsible && !isDesktop;

  const close = () => {
    setOpen(false);
    // 長い図の下で閉じても位置を見失わないよう、頭へ戻す
    toggleRef.current?.focus();
    toggleRef.current?.scrollIntoView?.({ block: 'nearest' });
  };

  return (
    <div>
      {/* relative は、ボタンの押せる範囲（after:inset-0）を頭全体に広げるため */}
      <div className="relative flex items-center gap-3">
        {badge}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight text-ink">
            {interactive ? (
              <button
                ref={toggleRef}
                type="button"
                aria-expanded={open}
                aria-controls={contentId}
                onClick={() => setOpen((v) => !v)}
                className="text-left after:absolute after:inset-0 after:content-['']"
              >
                {title}
              </button>
            ) : (
              title
            )}
          </h3>
          {details}
        </div>
        {collapsible && (
          <ChevronDown
            size={20}
            aria-hidden
            className={`flex-shrink-0 text-muted transition-transform lg:hidden ${open ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {collapsible && (
        // hidden 属性は使わない。Tailwind の preflight が display: none !important を当て、lg:block で上書きできない
        <div id={contentId} className={`${open ? 'block' : 'hidden'} mt-4 lg:block`}>
          {children}
          {open && (
            <button
              type="button"
              onClick={close}
              className="mt-4 flex w-full items-center justify-center gap-1 rounded-input py-2.5 text-sm font-bold text-ink-soft hover:bg-subtle lg:hidden"
            >
              閉じる
            </button>
          )}
        </div>
      )}
    </div>
  );
}
