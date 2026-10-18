import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Line } from '@/types';

type Props = {
  line: Line;
};

export function LineAccordion({ line }: Props) {
  return (
    <Link href={`/lines/${line.slug}/stations`}>
      <div className="flex items-center gap-3 px-2 py-3 rounded-input hover:bg-brand-50 transition-colors group mt-1">
        {/* Line color bar */}
        <div
          className="w-1 h-10 rounded-full flex-shrink-0"
          style={{ backgroundColor: line.color || 'var(--color-rail-line-fallback)' }}
        />
        <div className="flex-1 min-w-0">
          {/* 路線色は縦線だけに使う。文字に使うと銀座線などで白地とのコントラストが足りない */}
          <p className="font-medium text-sm leading-tight text-ink">
            {line.name}
          </p>
          {line.nameEn && (
            <p className="text-xs text-muted mt-0.5">{line.nameEn}</p>
          )}
        </div>
        <ChevronRight
          size={16}
          className="text-muted flex-shrink-0 group-hover:text-brand-600 transition-colors"
        />
      </div>
    </Link>
  );
}
