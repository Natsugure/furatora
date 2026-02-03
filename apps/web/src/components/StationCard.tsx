import { StationBadge } from './ui/StationBadge';
import type { StationWithOrder } from '@/types';

type Props = {
  station: StationWithOrder;
  lineColor: string | null;
  isFirst: boolean;
  isLast: boolean;
};

export function StationCard({ station, lineColor, isFirst, isLast }: Props) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
      {/* Station numbering badge */}
      <StationBadge code={station.code} color={lineColor} />

      {/* Station info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-lg">{station.name}</h3>
        {station.nameEn && (
          <p className="text-sm text-gray-500">{station.nameEn}</p>
        )}
      </div>
    </div>
  );
}
