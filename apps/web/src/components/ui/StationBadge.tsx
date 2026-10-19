import { parseStationCode } from '@/features/station/domain/stationCode';
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

  const parts = parseStationCode(code);

  return (
    <div className={`${badgeClassName} flex-col text-ink`} style={style}>
      {parts ? (
        <>
          <span className="text-[11px] leading-none">
            {parts.lineSymbol}
          </span>
          <span className="text-[17px] leading-none">{parts.number}</span>
        </>
      ) : (
        <span className="text-xs">{code}</span>
      )}
    </div>
  );
}
