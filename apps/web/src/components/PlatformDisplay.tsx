import type { CarStopPosition, CarStructure, FreeSpace, PrioritySeat } from '@furatora/database/schema';
import { TrainVisualization } from './TrainVisualization';

type Platform = {
  id: string;
  platformNumber: string;
  lineId: string;
  inboundDirectionId: string | null;
  outboundDirectionId: string | null;
  maxCarCount: number;
  carStopPositions: CarStopPosition[] | null;
  platformSide: string | null;
  notes: string | null;
};

type Line = {
  id: string;
  name: string;
  nameEn: string | null;
  color: string | null;
};

type Direction = {
  id: string;
  displayName: string;
  displayNameEn: string | null;
};

type Train = {
  id: string;
  name: string;
  carCount: number;
  carStructure: CarStructure[] | null;
  freeSpaces: FreeSpace[] | null;
  prioritySeats: PrioritySeat[] | null;
};

export type FacilityConnection = {
  stationName: string;
  lineNames: string[];
  lineColors: (string | null)[];
  directionName: string | null;
  exitLabel: string | null;
};

export type Facility = {
  id: string;
  typeCode: string;
  typeName: string;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
};

export type PlatformLocationCell = {
  nearPlatformCell: number | null;
  facilities: Facility[];
};

export type PlatformLocation = {
  id: string;
  exits: string | null;
  cells: PlatformLocationCell[];
  connections: FacilityConnection[];
};

type Props = {
  platform: Platform;
  line: Line;
  inboundDirection: Direction | null;
  outboundDirection: Direction | null;
  trains: Train[];
  locations: PlatformLocation[];
};

export function PlatformDisplay({
  platform,
  line,
  inboundDirection,
  outboundDirection,
  trains,
  locations,
}: Props) {
  const directions = [
    inboundDirection?.displayName,
    outboundDirection?.displayName,
  ]
    .filter(Boolean)
    .join(' / ');

  const platformSide =
    platform.platformSide === 'top' || platform.platformSide === 'bottom'
      ? platform.platformSide
      : null;

  const lineColor = line.color || '#6b7280';

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
                {line.name}
                {directions && ` — ${directions}`}
              </p>
            </div>
          </div>

          {/* Trains stopping at this platform */}
          {trains.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                列車・ホーム設備
              </p>
              <div className="space-y-4">
                {trains.map((train) => (
                  <TrainVisualization
                    key={train.id}
                    train={train}
                    platformMaxCarCount={platform.maxCarCount}
                    carStopPositions={platform.carStopPositions}
                    locations={locations}
                    platformSide={platformSide}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">列車情報がありません</p>
          )}

          {/* Facility summary section */}
          {locations.length > 0 && locations.some((loc) => loc.cells.length > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                設備・乗換情報
              </p>
              <div className="space-y-3">
                {[...locations].sort((a, b) => {
                  const aCell = a.cells.find((c) => c.nearPlatformCell !== null)?.nearPlatformCell ?? null;
                  const bCell = b.cells.find((c) => c.nearPlatformCell !== null)?.nearPlatformCell ?? null;
                  if (aCell === null) return 1;
                  if (bCell === null) return -1;
                  return aCell - bCell;
                }).map((loc) => {
                  if (loc.cells.length === 0) return null;
                  const connectionHeader = loc.connections.length > 0
                    ? loc.connections.map((conn) => {
                        const lineLabel = conn.lineNames.join('・');
                        return conn.directionName
                          ? `${lineLabel}（${conn.directionName}方面）`
                          : lineLabel;
                      }).join('・')
                    : null;
                  return (
                    <div key={loc.id}>
                      {connectionHeader && (
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          {connectionHeader}
                        </p>
                      )}
                      <ul className="space-y-0.5">
                        {[...loc.cells].sort((a, b) => {
                            if (a.nearPlatformCell === null) return 1;
                            if (b.nearPlatformCell === null) return -1;
                            return a.nearPlatformCell - b.nearPlatformCell;
                          }).map((cell, idx) => {
                          const cellLabel = cell.nearPlatformCell !== null
                            ? `${cell.nearPlatformCell}号車付近`
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
