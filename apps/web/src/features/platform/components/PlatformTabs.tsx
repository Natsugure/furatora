'use client';

import { useState } from 'react';
import { PlatformDisplay } from './PlatformDisplay';
import type { DirectionTabDTO } from '@furatora/platform-diagram/domain';

type Props = {
  tabs: DirectionTabDTO[];
};

export function PlatformTabs({ tabs }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      {/* Tab header */}
      <div className="bg-surface rounded-card border-[1.5px] border-subtle mb-4 overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab, i) => (
            <button
              key={tab.directionId ?? 'all'}
              onClick={() => setActiveIndex(i)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                i === activeIndex
                  ? 'border-brand-600 text-brand-700 font-bold bg-brand-50'
                  : 'border-transparent text-ink-soft hover:text-ink hover:bg-subtle'
              }`}
            >
              {tab.directionName}
            </button>
          ))}
        </div>
      </div>

      {/* Active tab platforms */}
      <div className="space-y-4">
        {tabs[activeIndex]?.platforms.map((platform) => (
          <PlatformDisplay key={platform.id} platform={platform} />
        ))}
      </div>
    </div>
  );
}
