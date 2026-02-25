'use client';

import { useState } from 'react';
import { Search, Train } from 'lucide-react';
import { StationSearch } from './StationSearch';
import { OperatorList } from './OperatorList';
import type { OperatorWithLines } from '@/types';

type Tab = 'station' | 'line';

type Props = {
  operators: OperatorWithLines[];
};

export function SearchTabs({ operators }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('station');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* タブバー */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('station')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'station'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Search size={15} />
          駅名で検索
        </button>
        <button
          onClick={() => setActiveTab('line')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'line'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Train size={15} />
          路線から検索
        </button>
      </div>

      {/* タブコンテンツ */}
      <div className="p-4">
        {activeTab === 'station' ? (
          <StationSearch />
        ) : operators.length > 0 ? (
          <OperatorList operators={operators} />
        ) : (
          <p className="text-center text-gray-500 py-8 text-sm">事業者データがありません</p>
        )}
      </div>
    </div>
  );
}
