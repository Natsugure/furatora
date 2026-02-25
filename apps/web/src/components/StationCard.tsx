import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { StationBadge } from './ui/StationBadge';
import type { StationWithOrder } from '@/types';

type Props = {
  station: StationWithOrder;
  lineColor: string | null;
  isFirst: boolean;
  isLast: boolean;
};

export function StationCard({ station, lineColor }: Props) {
  return (
    <Link href={`/stations/${station.slug ?? station.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 hover:shadow-md hover:border-blue-200 transition-all">
        <StationBadge code={station.code} color={lineColor} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight text-gray-900">
            {station.name}
          </h3>
          {station.nameEn && (
            <p className="text-sm text-gray-500 mt-0.5">{station.nameEn}</p>
          )}
        </div>
        <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
      </div>
    </Link>
  );
}
