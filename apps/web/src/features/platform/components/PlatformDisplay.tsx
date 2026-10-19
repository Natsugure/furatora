import {
  computeBounds,
  layoutConcoursePlates,
  layoutFacingBanners,
  connectionLabels,
  exitsLabel,
  hasDisplayableInfo,
  isDrawable,
  type PlatformDTO,
} from '@furatora/platform-diagram/domain';
import { PlatformDiagram } from '@furatora/platform-diagram/components';
import { railLineColor } from '@/theme/railLineColor';

type Props = {
  platform: PlatformDTO;
};

export function PlatformDisplay({ platform }: Props) {
  const directions = [platform.inboundDirectionName, platform.outboundDirectionName]
    .filter(Boolean)
    .join(' / ');

  const lineColor = railLineColor(platform.lineColor);
  const bounds = computeBounds(platform.physicalLength, platform.stopPatterns, platform.concourses);
  // コンコースはホーム単位の情報で停車位置パターンごとに変わらない。ここで1度だけ算出し
  // 全パターンに同じものを渡す（パターンごとに算出すると段の割り当てがずれる）
  const plateLayout = layoutConcoursePlates(platform.concourses, bounds);
  const facingLayout = layoutFacingBanners(platform.concourses, bounds);

  // 図に描けないコンコース（座標を持つアクセス点が無い）だけをテキストで補う。
  // 描けるものは図のプレートが全文を持っているので、ここに重ねて出す意味はない。
  const undrawable = platform.concourses.filter((c) => !isDrawable(c) && hasDisplayableInfo(c));

  return (
    <div className="overflow-hidden rounded-card border-[1.5px] border-subtle bg-surface">
      <div className="flex items-stretch">
        {/* Left color bar */}
        <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: lineColor }} />
        {/* min-w-0 は必須。flex アイテム既定の min-width:auto のままだと、
            図のキャンバス（min-width = 描画範囲×PX_PER_METER）まで幅が膨らみ、
            内側の overflow-x-auto がスクロールせず親の overflow-hidden に切り落とされる */}
        <div className="min-w-0 flex-1 p-5">
          {/* Platform header */}
          <div className="mb-4 flex items-center gap-3">
            {/* 路線色で塗って白い文字を載せると、明るい路線色では読めない（REQ-10）。
                路線色は輪だけに使い、番号は白地に text-ink で書く（StationBadge・LineSymbol と同じ） */}
            <div
              className="flex size-9 flex-shrink-0 items-center justify-center rounded-full border-[3px] bg-surface font-display text-base font-bold text-ink"
              style={{ borderColor: lineColor }}
            >
              {platform.platformNumber}
            </div>
            <div>
              <h3 className="font-display text-lg font-bold leading-tight text-ink">
                {platform.platformNumber}番線
              </h3>
              <p className="text-[13px] text-muted">
                {platform.lineName}
                {directions && ` — ${directions}`}
              </p>
            </div>
          </div>

          {/* Trains stopping at this platform */}
          {platform.physicalLength === 0 ? (
            <div className="rounded-input bg-canvas p-4 text-center text-sm text-muted">
              ホーム長が未登録のため図を表示できません
            </div>
          ) : platform.stopPatterns.length > 0 ? (
            <div>
              <p className="mb-3 text-xs font-bold text-muted">
                列車・ホーム設備
              </p>
              <div className="space-y-4">
                {platform.stopPatterns.map((pattern) => (
                  <PlatformDiagram
                    key={pattern.trainId}
                    pattern={pattern}
                    physicalLength={platform.physicalLength}
                    concourses={platform.concourses}
                    platformSide={platform.platformSide}
                    bounds={bounds}
                    plateLayout={plateLayout}
                    facingLayout={facingLayout}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">列車情報がありません</p>
          )}

          {/* 位置が登録されていないコンコース。図に描けないぶんをここで補う */}
          {undrawable.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-1 text-xs font-bold text-muted">
                位置未登録の設備・乗換
              </p>
              <p className="mb-3 text-xs text-muted">
                ホーム上の位置が登録されていないため、図には表示していません。
              </p>
              <div className="space-y-3">
                {undrawable.map((concourse) => {
                  const exits = exitsLabel(concourse);
                  const connections = connectionLabels(concourse);
                  const facilityNames = [
                    ...new Set(concourse.cells.flatMap((cell) => cell.facilities.map((f) => f.typeName))),
                  ];

                  return (
                    <div key={concourse.id}>
                      {exits && <p className="text-sm font-medium text-ink">{exits}</p>}
                      {connections.length > 0 && (
                        <p className="text-sm text-ink-soft">
                          <span className="text-muted">乗換: </span>
                          {connections.join('・')}
                        </p>
                      )}
                      {facilityNames.length > 0 && (
                        <p className="text-sm text-ink-soft">
                          <span className="text-muted">設備: </span>
                          {facilityNames.join('・')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Platform notes */}
          {platform.notes && (
            <div className="mt-4 rounded-input bg-subtle p-3 text-sm text-ink-soft">
              {platform.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
