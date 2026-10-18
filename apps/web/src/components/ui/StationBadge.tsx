import { railLineColor } from '@/theme/railLineColor';

type Props = {
  code: string | null;
  color: string | null;
};

// バッジの直径（px）。駅一覧のタイムラインの線は、この値から位置を求めてバッジの中心を通す（StationTimeline）
export const STATION_BADGE_SIZE = 54;

const badgeClassName =
  'rounded-full border-4 flex items-center justify-center bg-surface font-display font-bold flex-shrink-0';

export function StationBadge({ code, color }: Props) {
  // 路線色は DB から来る。無いときはニュートラルの輪にする
  const style = { width: STATION_BADGE_SIZE, height: STATION_BADGE_SIZE, borderColor: railLineColor(color) };

  if (!code) {
    return (
      <div className={`${badgeClassName} text-muted text-xs`} style={style}>
        -
      </div>
    );
  }

  // Parse station code (e.g., "M08" -> { prefix: "M", number: "08" })
  const match = code.match(/^([A-Z]+)(\d+)$/);

  return (
    <div className={`${badgeClassName} flex-col text-ink`} style={style}>
      {match ? (
        <>
          <span className="text-[11px] leading-none">
            {match[1]}
          </span>
          <span className="text-[17px] leading-none">{match[2]}</span>
        </>
      ) : (
        <span className="text-xs">{code}</span>
      )}
    </div>
  );
}
