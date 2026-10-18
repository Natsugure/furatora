import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { StationBadge } from './ui/StationBadge';
import type { StationWithOrder } from '@/types';

type Props = {
  station: StationWithOrder;
  lineColor: string | null;
  isFirst: boolean;
  isLast: boolean;
};

// 線はバッジ（54px）の中心を通す
const segmentClassName = 'absolute left-6 w-[5px] opacity-55';

// 路線の駅一覧のタイムラインの1行。線は行ごとに上半分・下半分を描き、先頭・末尾で端を切る。
// 行の間に隙間があると線が途切れるため、呼び出し側は行を詰めて並べること
export function StationCard({ station, lineColor, isFirst, isLast }: Props) {
  const lineStyle = { backgroundColor: lineColor || 'var(--color-rail-line-fallback)' };

  return (
    <Link
      href={`/stations/${station.slug}`}
      className="relative flex items-center gap-4 min-h-23 py-2 group"
    >
      {!isFirst && (
        <span aria-hidden data-timeline="up" className={`${segmentClassName} top-0 bottom-1/2`} style={lineStyle} />
      )}
      {!isLast && (
        <span aria-hidden data-timeline="down" className={`${segmentClassName} top-1/2 bottom-0`} style={lineStyle} />
      )}
      {/* relative で、絶対配置の線よりバッジを上に重ねる */}
      <div className="relative">
        <StationBadge code={station.code} color={lineColor} />
      </div>
      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
        <h3 className="font-display font-bold text-[19px] leading-tight text-ink group-hover:text-brand-700 transition-colors">
          {station.name}
        </h3>
        {station.nameEn && (
          <p className="text-xs text-muted">{station.nameEn}</p>
        )}
      </div>
      <span className="size-7.5 rounded-full border-2 border-brand-300 text-brand-600 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-50 transition-colors">
        <ChevronRight size={14} strokeWidth={3} aria-hidden />
      </span>
    </Link>
  );
}
