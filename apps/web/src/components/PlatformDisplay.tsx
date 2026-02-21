import type { CarStopPosition, CarStructure, FreeSpace, PrioritySeat } from '@stroller-transit-app/database/schema';
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
  carStructure: CarStructure | null;
  freeSpaces: FreeSpace[] | null;
  prioritySeats: PrioritySeat[] | null;
};

export type FacilityConnection = {
  stationName: string;
  lineNames: string[];
  exitLabel: string | null;
};

export type Facility = {
  id: string;
  typeCode: string;
  typeName: string;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
};

export type PlatformLocation = {
  id: string;
  nearPlatformCell: number | null;
  exits: string | null;
  facilities: Facility[];
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
