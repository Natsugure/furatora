import { computeBounds } from '../domain/geometry';
import type { PlatformDTO } from '../domain/types';
import { TrainVisualization } from './TrainVisualization';

type Props = {
  platform: PlatformDTO;
};

export function PlatformDisplay({ platform }: Props) {
  const directions = [platform.inboundDirectionName, platform.outboundDirectionName]
    .filter(Boolean)
    .join(' / ');

  const lineColor = platform.lineColor || '#6b7280';
  const bounds = computeBounds(platform.physicalLength, platform.stopPatterns, platform.concourses);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-stretch">
        {/* Left color bar */}
        <div
          className="w-1.5 flex-shrink-0"
          style={{ backgroundColor: lineColor }}
        />
        <div className="flex-1 p-5">
          {/* Platform header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: lineColor }}
            >
              {platform.platformNumber}
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-tight text-gray-900">
                {platform.platformNumber}番線
              </h3>
              <p className="text-sm text-gray-500">
                {platform.lineName}
                {directions && ` — ${directions}`}
              </p>
            </div>
          </div>

          {/* Trains stopping at this platform */}
          {platform.physicalLength === 0 ? (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
              ホーム長が未登録のため図を表示できません
            </div>
          ) : platform.stopPatterns.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                列車・ホーム設備
              </p>
              <div className="space-y-4">
                {platform.stopPatterns.map((pattern) => (
                  <TrainVisualization
                    key={pattern.trainId}
                    pattern={pattern}
                    physicalLength={platform.physicalLength}
                    concourses={platform.concourses}
                    platformSide={platform.platformSide}
                    bounds={bounds}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">列車情報がありません</p>
          )}

          {/* Facility summary section */}
          {platform.concourses.length > 0 && platform.concourses.some((c) => c.cells.length > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                設備・乗換情報
              </p>
              <div className="space-y-3">
                {[...platform.concourses].sort((a, b) => {
                  const aX = a.cells.find((c) => c.xPositionMeters !== null)?.xPositionMeters ?? null;
                  const bX = b.cells.find((c) => c.xPositionMeters !== null)?.xPositionMeters ?? null;
                  if (aX === null) return 1;
                  if (bX === null) return -1;
                  return aX - bX;
                }).map((concourse) => {
                  if (concourse.cells.length === 0) return null;
                  const connectionHeader = concourse.connections.length > 0
                    ? concourse.connections.map((conn) => {
                        const lineLabel = conn.lineNames.join('・');
                        return conn.directionName
                          ? `${lineLabel}（${conn.directionName}方面）`
                          : lineLabel;
                      }).join('・')
                    : null;
                  return (
                    <div key={concourse.id}>
                      {connectionHeader && (
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          {connectionHeader}
                        </p>
                      )}
                      <ul className="space-y-0.5">
                        {[...concourse.cells].sort((a, b) => {
                            if (a.xPositionMeters === null) return 1;
                            if (b.xPositionMeters === null) return -1;
                            return a.xPositionMeters - b.xPositionMeters;
                          }).map((cell, idx) => {
                          const cellLabel = cell.xPositionMeters !== null
                            ? `ホーム端から ${cell.xPositionMeters}m付近`
                            : 'コンコース全体';
                          const facilityNames = cell.facilities.map((f) => f.typeName).join('・');
                          return (
                            <li key={idx} className="text-sm text-gray-600 flex gap-2">
                              <span className="text-gray-400 flex-shrink-0">{cellLabel}:</span>
                              <span>{facilityNames}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Platform notes */}
          {platform.notes && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              {platform.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
