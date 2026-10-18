'use client';

import { useState } from 'react';
import { StationSearch } from './StationSearch';
import { OperatorList } from './OperatorList';
import type { OperatorWithLines } from '@/types';

type Tab = 'station' | 'line';

type Props = {
  operators: OperatorWithLines[];
};

const TABS: { value: Tab; label: string }[] = [
  { value: 'station', label: '駅名で検索' },
  { value: 'line', label: '路線から検索' },
];

export function SearchTabs({ operators }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('station');

  return (
    <div className="flex flex-col gap-5">
      {/* タブバー（角丸のセグメント） */}
      <div className="flex p-1 rounded-full bg-subtle">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 h-11 rounded-full text-sm transition-colors ${
                isActive
                  ? 'bg-surface text-brand-600 font-bold shadow-raised'
                  : 'text-ink-soft font-medium hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'station' ? (
        <StationSearch />
      ) : operators.length > 0 ? (
        <OperatorList operators={operators} />
      ) : (
        <p className="text-center text-muted py-8 text-sm">事業者データがありません</p>
      )}
    </div>
  );
}
