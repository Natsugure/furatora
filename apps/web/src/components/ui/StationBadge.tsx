import { railLineColor } from '@/theme/railLineColor';

type Props = {
  code: string | null;
  color: string | null;
};

const badgeClassName =
  'size-13.5 rounded-full border-4 flex items-center justify-center bg-surface font-display font-bold flex-shrink-0';

export function StationBadge({ code, color }: Props) {
  // 路線色は DB から来る。無いときはニュートラルの輪にする
  const style = { borderColor: railLineColor(color) };

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
