import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Line } from '@/types';

type Props = {
  line: Line;
};

export function LineAccordion({ line }: Props) {
  return (
    <Link href={`/lines/${line.slug}/stations`}>
      <div className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-blue-50 transition-colors group mt-1">
        {/* Line color bar */}
        <div
          className="w-1 h-10 rounded-full flex-shrink-0"
          style={{ backgroundColor: line.color || '#888888' }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="font-medium text-sm leading-tight"
            style={{ color: line.color || '#374151' }}
          >
            {line.name}
          </p>
          {line.nameEn && (
            <p className="text-xs text-gray-500 mt-0.5">{line.nameEn}</p>
          )}
        </div>
        <ChevronRight
          size={16}
          className="text-gray-400 flex-shrink-0 group-hover:text-blue-500 transition-colors"
        />
      </div>
    </Link>
  );
}
