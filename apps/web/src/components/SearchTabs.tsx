'use client';

import { useState } from 'react';
import { SegmentedControl } from '@mantine/core';
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

// SegmentedControl の onChange は string を返すため、Tab に絞り込む
function isTab(value: string): value is Tab {
  return TABS.some((tab) => tab.value === value);
}

export function SearchTabs({ operators }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('station');

  return (
    <div className="flex flex-col gap-5">
      {/* 検索方法の切り替え。どちらか1つを選ぶ部品なので、ラジオボタンのグループ（SegmentedControl）にする。
          見た目は Tailwind のクラスで当てる（Mantine の CSS は @layer mantine にあり、utilities が勝つ。layers.css） */}
      <SegmentedControl
        fullWidth
        aria-label="検索方法"
        value={activeTab}
        onChange={(value) => { if (isTab(value)) setActiveTab(value); }}
        data={TABS}
        classNames={{
          root: 'p-1 rounded-full bg-subtle',
          indicator: 'rounded-full bg-surface shadow-raised',
          label: 'flex items-center justify-center h-11 py-0 rounded-full text-sm font-medium text-ink-soft hover:text-ink data-[active]:font-bold data-[active]:text-brand-600',
        }}
      />

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
