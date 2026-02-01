import Link from 'next/link';
import type { Line } from '@/types';

type Props = {
  line: Line;
};

export function LineAccordion({ line }: Props) {
  return (
    <Link
      href={`/lines/${line.id}/stations`}
      className="block p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Line color indicator */}
        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: line.color || '#888888' }}
        />
        <div className="flex-1 min-w-0">
          <span className="font-medium">{line.name}</span>
          {line.nameEn && (
            <span className="text-sm text-gray-500 ml-2">{line.nameEn}</span>
          )}
        </div>
        <span className="text-gray-400 flex-shrink-0">→</span>
      </div>
    </Link>
  );
}
