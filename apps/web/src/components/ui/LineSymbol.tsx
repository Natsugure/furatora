import { parseStationCode } from '@/features/station/domain/stationCode';
import { railLineColor } from '@/theme/railLineColor';

type Props = {
  /** lines.line_code（例: G）。未登録の路線は null */
  lineCode: string | null;
  /** 路線コードが無いときに英字を取る駅番号（先頭の駅など） */
  fallbackStationCode: string | null;
  color: string | null;
};

// 路線の見出しの、路線色の輪に路線記号を入れた印。
// 路線色で塗った上に白い文字を載せると、銀座線（#F39700）など明るい路線色ではコントラストが 3:1 にも届かない（REQ-10）。
// そのため駅のバッジ（StationBadge）と同じく、路線色は輪だけに使い、文字は白地に text-ink で書く。
// 路線コードを優先し、無ければ駅番号の英字を使う。どちらも無ければ描かない
export function LineSymbol({ lineCode, fallbackStationCode, color }: Props) {
  const symbol = lineCode || (fallbackStationCode && parseStationCode(fallbackStationCode)?.lineSymbol);
  if (!symbol) return null;

  return (
    <div
      role="img"
      aria-label={`路線記号 ${symbol}`}
      className="size-15 rounded-full border-[5px] bg-surface flex items-center justify-center flex-shrink-0 font-display font-bold text-[26px] text-ink"
      style={{ borderColor: railLineColor(color) }}
    >
      {symbol}
    </div>
  );
}
