export const dynamic = 'force-dynamic';

import { ArrowRightLeft, ArrowDownUp, Armchair, type LucideIcon } from 'lucide-react';
import { getVisibleOperatorsWithLines } from '@/external/query/operatorListQuery';
import { SearchTabs } from '@/components/SearchTabs';
import { Container } from '@/components/ui/Container';
import { Sheet } from '@/components/ui/Sheet';

// ふらとらでわかること。先頭（主な機能）だけを塗りの丸にする
const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: ArrowRightLeft, title: 'バリアフリー対応の乗り換えルート', description: '他社線同士の乗り換えも案内' },
  { icon: ArrowDownUp, title: 'ホームの出口・乗り換え設備', description: 'エレベーター・階段の位置を図で表示' },
  { icon: Armchair, title: 'フリースペース・優先席', description: '車内のどこにあるかを図で表示' },
];

export default async function Home() {
  const operatorsWithLines = await getVisibleOperatorsWithLines();

  return (
    <>
      <Container className="pt-4 pb-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-medium text-muted">ベビーカー・車いすでの乗り換えを、やさしく</p>
          {/* ローズの文字は 32px の太字で、大きい文字の基準（3:1）で読む */}
          <h1 className="font-display font-bold text-[32px] leading-[1.3] text-ink">
            <span className="text-brand-500">どの駅</span>へ<br />行きますか？
          </h1>
        </div>
        <SearchTabs operators={operatorsWithLines} />
      </Container>

      <Sheet className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display font-bold text-lg text-ink">ふらとらでわかること</h2>
            <p className="text-[13px] leading-[1.7] text-muted">
              各駅のバリアフリー設備と、車内のフリースペース・優先席の位置を図で確認できます。
            </p>
          </div>
          <ul className="relative flex flex-col">
            {/* 丸をつなぐ点線。先頭と末尾の丸の中心で止める */}
            <span aria-hidden className="absolute left-6.5 top-13 bottom-13 border-l-[2.5px] border-dashed border-brand-200" />
            {FEATURES.map(({ icon: Icon, title, description }, i) => (
              <li key={title} className="relative flex items-center gap-4 py-2.5">
                <span
                  className={`size-13 rounded-full flex items-center justify-center flex-shrink-0 ${
                    i === 0 ? 'bg-brand-500 text-white' : 'bg-subtle text-brand-500'
                  }`}
                >
                  <Icon size={24} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-bold text-base text-ink">{title}</span>
                  <span className="text-[13px] text-muted">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <hr className="border-subtle" />

        <section className="flex flex-col gap-3">
          <h2 className="font-display font-bold text-base text-ink">対応している事業者</h2>
          {/* 事業者には色の列が無いため、見本のチップの色の丸は描かない（design.md） */}
          <ul className="flex flex-wrap gap-2">
            {operatorsWithLines.map((op) => (
              <li key={op.id} className="h-9.5 px-4 inline-flex items-center rounded-full bg-subtle text-sm font-medium text-ink">
                {op.name}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">※今後、首都圏を中心に追加予定です。</p>
        </section>
      </Sheet>
    </>
  );
}
