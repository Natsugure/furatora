import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { StationBadge } from './ui/StationBadge';
import type { StationWithOrder } from '@/types';
import { railLineColor } from '@/theme/railLineColor';

type Props = {
  stations: StationWithOrder[];
  lineColor: string | null;
};

// 線の太さ（px）。線はバッジの列（幅 = バッジの直径）の 50% の位置から、太さの半分だけ左に戻して中心を通す。
// バッジの直径を参照しないので、直径を変えても中心を通る
const LINE_WIDTH = 5;
const segmentClassName = 'absolute opacity-55';

// 路線の駅一覧のタイムライン。路線色の線で駅番号の丸をつなぐ（REQ-8）
export function StationTimeline({ stations, lineColor }: Props) {
  const lineStyle = {
    left: '50%',
    // translateX(-50%) ではなく margin にするのは、単体テスト（jsdom）で数値として確かめられるため
    marginLeft: -LINE_WIDTH / 2,
    width: LINE_WIDTH,
    backgroundColor: railLineColor(lineColor),
  };

  // 線は行ごとに上半分・下半分を描き、先頭・末尾で端を切る。行の間に隙間があると線が途切れるため、行は詰めて並べる
  return (
    <ol>
      {stations.map((station, index) => (
        <li key={station.id}>
          <Link
            href={`/stations/${station.slug}`}
            className="flex items-stretch gap-4 min-h-23 group"
          >
            {/* バッジの列。行の高さいっぱいに伸ばし、線はこの列の中央に置く。
                列の幅がバッジの直径になるよう、線のほかにはバッジだけを置き、横の余白を付けない */}
            <div data-timeline="column" className="relative flex items-center py-2">
              {index > 0 && (
                <span aria-hidden data-timeline="up" className={`${segmentClassName} top-0 bottom-1/2`} style={lineStyle} />
              )}
              {index < stations.length - 1 && (
                <span aria-hidden data-timeline="down" className={`${segmentClassName} top-1/2 bottom-0`} style={lineStyle} />
              )}
              {/* relative で、絶対配置の線よりバッジを上に重ねる */}
              <div className="relative">
                <StationBadge code={station.code} color={lineColor} />
              </div>
            </div>
            <div className="flex-1 min-w-0 self-center py-2 flex flex-wrap items-baseline gap-x-2">
              <h3 className="font-display font-bold text-[19px] leading-tight text-ink group-hover:text-brand-700 transition-colors">
                {station.name}
              </h3>
              {station.nameEn && (
                <p className="text-xs text-muted">{station.nameEn}</p>
              )}
            </div>
            <span className="self-center size-7.5 rounded-full border-2 border-brand-300 text-brand-600 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-50 transition-colors">
              <ChevronRight size={14} strokeWidth={3} aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
