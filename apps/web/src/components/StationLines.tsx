import type { LineRef, ReachableLines } from '@/features/station/domain/reachableLines';
import { railLineColor } from '@/theme/railLineColor';

// 駅の詳細の見出しの路線（Issue #172）。この駅名で乗れる路線と、別の駅名の乗換先の路線を段で分ける。
// 別の駅へは徒歩で移るため、同じ見た目で並べると、その駅で乗れるように見えてしまう。
// 件数は絞らず、折り返して全部出す
type Props = { lines: ReachableLines };

function LineChips({ lines, label }: { lines: LineRef[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {lines.map((l) => (
        <li key={l.lineName} className="h-7.5 pl-1.5 pr-3 inline-flex items-center gap-1.5 rounded-full bg-surface text-xs font-medium text-ink">
          <span aria-hidden className="size-4 rounded-full flex-shrink-0" style={{ backgroundColor: railLineColor(l.lineColor) }} />
          {l.lineName}
        </li>
      ))}
    </ul>
  );
}

export function StationLines({ lines }: Props) {
  if (lines.here.length === 0 && lines.transfers.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 mt-4">
      {lines.here.length > 0 && <LineChips lines={lines.here} label="路線" />}
      {lines.transfers.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted">乗り換え</h2>
          {lines.transfers.map((t) => (
            <div key={t.stationName} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-[13px] font-medium text-ink-soft">{t.stationName}</span>
              <LineChips lines={t.lines} label={`${t.stationName}の路線`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
