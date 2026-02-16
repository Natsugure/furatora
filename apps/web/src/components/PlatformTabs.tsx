'use client';

import { useState } from 'react';
import { PlatformDisplay, type Facility } from './PlatformDisplay';
import type { CarStopPosition, FreeSpace, PrioritySeat } from '@stroller-transit-app/database/schema';

type PlatformData = {
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

type LineData = {
  id: string;
  name: string;
  nameEn: string | null;
  color: string | null;
};

type DirectionData = {
  id: string;
  displayName: string;
  displayNameEn: string | null;
} | null;

type TrainData = {
  id: string;
  name: string;
  carCount: number;
  freeSpaces: FreeSpace[] | null;
  prioritySeats: PrioritySeat[] | null;
};

export type PlatformEntry = {
  platform: PlatformData;
  line: LineData;
  inboundDirection: DirectionData;
  outboundDirection: DirectionData;
  trains: TrainData[];
  facilities: Facility[];
};

export type DirectionTab = {
  directionId: string | null;
  directionName: string;
  platforms: PlatformEntry[];
};

type Props = {
  tabs: DirectionTab[];
};

export function PlatformTabs({ tabs }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      {/* Tab header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab, i) => (
            <button
              key={tab.directionId ?? 'all'}
              onClick={() => setActiveIndex(i)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                i === activeIndex
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.directionName}
            </button>
          ))}
        </div>
      </div>

      {/* Active tab platforms */}
      <div className="space-y-4">
        {tabs[activeIndex]?.platforms.map((entry) => (
          <PlatformDisplay
            key={entry.platform.id}
            platform={entry.platform}
            line={entry.line}
            inboundDirection={entry.inboundDirection}
            outboundDirection={entry.outboundDirection}
            trains={entry.trains}
            facilities={entry.facilities}
          />
        ))}
      </div>
    </div>
  );
}
