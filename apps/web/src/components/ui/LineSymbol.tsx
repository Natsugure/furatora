import { railLineColor } from '@/theme/railLineColor';

type Props = {
  /** lines.line_code（例: G）。未登録の路線は null */
  lineCode: string | null;
  /** 路線コードが無いときに英字を取る駅番号（先頭の駅など） */
  fallbackStationCode: string | null;
  color: string | null;
};

// 路線の見出しの、路線色の丸に路線記号を白抜きした印。
// 路線コードを優先し、無ければ駅番号の先頭の英字を使う。どちらも無ければ描かない
export function LineSymbol({ lineCode, fallbackStationCode, color }: Props) {
  const symbol = lineCode || fallbackStationCode?.match(/^[A-Za-z]+/)?.[0];
  if (!symbol) return null;

  return (
    <div
      role="img"
      aria-label={`路線記号 ${symbol}`}
      className="size-15 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-[28px] text-white"
      style={{ backgroundColor: railLineColor(color) }}
    >
      {symbol}
    </div>
  );
}
