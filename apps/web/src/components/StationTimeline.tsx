import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { STATION_BADGE_SIZE, StationBadge } from './ui/StationBadge';
import type { StationWithOrder } from '@/types';
import { railLineColor } from '@/theme/railLineColor';

type Props = {
  stations: StationWithOrder[];
  lineColor: string | null;
};

// 線の太さ（px）。位置はバッジの直径から求め、バッジの中心を通す
const LINE_WIDTH = 5;
const segmentClassName = 'absolute opacity-55';

type RowProps = {
  station: StationWithOrder;
  lineColor: string | null;
  isFirst: boolean;
  isLast: boolean;
};

// 1駅ぶんの行。線は行ごとに上半分・下半分を描き、先頭・末尾で端を切る。
// 行の間に隙間があると線が途切れるため、行は StationTimeline の中でだけ詰めて並べる（export しない）
function StationRow({ station, lineColor, isFirst, isLast }: RowProps) {
  const lineStyle = {
    left: STATION_BADGE_SIZE / 2 - LINE_WIDTH / 2,
    width: LINE_WIDTH,
    backgroundColor: railLineColor(lineColor),
  };

  return (
    <li>
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
    </li>
  );
}

// 路線の駅一覧のタイムライン。路線色の線で駅番号の丸をつなぐ（REQ-8）
export function StationTimeline({ stations, lineColor }: Props) {
  return (
    <ol>
      {stations.map((station, index) => (
        <StationRow
          key={station.id}
          station={station}
          lineColor={lineColor}
          isFirst={index === 0}
          isLast={index === stations.length - 1}
        />
      ))}
    </ol>
  );
}
