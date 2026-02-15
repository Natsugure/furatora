import type { CarStopPosition, FreeSpace, PrioritySeat } from '@stroller-transit-app/database/schema';
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
  freeSpaces: FreeSpace[] | null;
  prioritySeats: PrioritySeat[] | null;
};

export type Facility = {
  id: string;
  typeCode: string;
  typeName: string;
  nearPlatformCell: number | null;
  exits: string | null;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
};

type Props = {
  platform: Platform;
  line: Line;
  inboundDirection: Direction | null;
  outboundDirection: Direction | null;
  trains: Train[];
  facilities: Facility[];
};

const FACILITY_ICONS: Record<string, string> = {
  elevator: '🛗',
  escalator: '⚡',
  stairs: '🚶',
  ramp: '♿',
  stairLift: '🦽',
  sameFloor: '↔️',
};

export function PlatformDisplay({
  platform,
  line,
  inboundDirection,
  outboundDirection,
  trains,
  facilities,
}: Props) {
  // 方向情報の表示
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

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      {/* Platform header */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: line.color || '#888888' }}
        >
          {platform.platformNumber}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold">
            {platform.platformNumber}番線
          </h3>
          <p className="text-sm text-gray-600">
            {line.name} {directions && `(${directions})`}
          </p>
        </div>
        <div className="text-sm text-gray-500">
          最大{platform.maxCarCount}両編成対応
        </div>
      </div>

      {/* Platform facilities (text list) */}
      {facilities.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded">
          <h4 className="text-sm font-semibold mb-2">ホーム設備</h4>
          <div className="space-y-1">
            {facilities.map((facility) => {
              const inaccessible =
                facility.isWheelchairAccessible === false ||
                facility.isStrollerAccessible === false;
              return (
                <div key={facility.id} className="text-sm flex items-center gap-2">
                  <span className="text-lg">
                    {FACILITY_ICONS[facility.typeCode] || '📍'}
                  </span>
                  <span>
                    {facility.nearPlatformCell && `${facility.nearPlatformCell}号車付近 - `}
                    {facility.exits || facility.typeName}
                    {inaccessible && (
                      <span className="ml-1 text-xs text-amber-600">
                        {facility.isWheelchairAccessible === false && '車椅子不可'}
                        {facility.isWheelchairAccessible === false && facility.isStrollerAccessible === false && ' / '}
                        {facility.isStrollerAccessible === false && 'ベビーカー不可'}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trains stopping at this platform */}
      {trains.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold mb-3 text-gray-700">
            停車する列車
          </h4>
          <div className="space-y-4">
            {trains.map((train) => (
              <TrainVisualization
                key={train.id}
                train={train}
                platformMaxCarCount={platform.maxCarCount}
                carStopPositions={platform.carStopPositions}
                facilities={facilities}
                platformSide={platformSide}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">列車情報がありません</p>
      )}

      {platform.notes && (
        <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-700">
          <strong>備考:</strong> {platform.notes}
        </div>
      )}
    </div>
  );
}
