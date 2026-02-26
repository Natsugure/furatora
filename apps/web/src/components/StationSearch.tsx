'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import type { StationGroup, StationSearchApiResponse } from '@/types';

export function StationSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [groups, setGroups] = useState<StationGroup[]>([]);
  const [fetchedFor, setFetchedFor] = useState('');
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // debouncedQuery が変わった瞬間に loading=true となるよう派生させる
  const loading = debouncedQuery !== '' && fetchedFor !== debouncedQuery;
  const displayedGroups = debouncedQuery ? groups : [];
  const showResults = debouncedQuery.length > 0;

  // 入力から 300ms 後に検索クエリを確定
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // 確定したクエリで API を叩く
  useEffect(() => {
    if (!debouncedQuery) return;
    let cancelled = false;
    fetch(`/api/v1/stations?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json() as Promise<StationSearchApiResponse>;
      })
      .then((data) => {
        if (!cancelled) setGroups(data.stationGroups);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setFetchedFor(debouncedQuery);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  return (
    <div ref={containerRef} className="relative">
      {/* 入力欄 */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHasError(false); }}
          placeholder="駅名で検索（例：茅場町）"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        />
      </div>

      {/* 検索結果 */}
      {showResults && (
        <div className="mt-2 space-y-2">
          {loading && displayedGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-5 flex flex-col items-center gap-2 text-sm text-gray-500">
              <Loader2 size={20} className="animate-spin text-blue-400" />
              <span>検索中…</span>
            </div>
          ) : hasError ? (
            <div className="bg-white rounded-xl border border-red-200 shadow-sm px-4 py-5 text-sm text-center text-red-500">
              検索中にエラーが発生しました。しばらくしてから再度お試しください。
            </div>
          ) : displayedGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-5 text-sm text-center text-gray-500">
              「{debouncedQuery}」に一致する駅が見つかりませんでした
            </div>
          ) : (
            <>
              {loading && (
                <div className="flex justify-center py-1">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              )}
              {displayedGroups.map((group) => (
                <StationGroupCard key={group.name} group={group} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StationGroupCard({ group }: { group: StationGroup }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <p className="font-semibold text-base text-gray-900">{group.name}</p>
        {group.nameEn && (
          <p className="text-xs text-gray-500 mt-0.5">{group.nameEn}</p>
        )}
      </div>
      <div className="border-t border-gray-100">
        {group.stations.map((station) => (
          <Link
            key={station.id}
            href={`/stations/${station.slug ?? station.id}`}
          >
            <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors group">
              <div
                className="w-1 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: station.lineColor ?? '#888888' }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium leading-tight"
                  style={{ color: station.lineColor ?? '#374151' }}
                >
                  {station.lineName ?? '不明な路線'}
                </p>
                {station.code && (
                  <p className="text-xs text-gray-400 mt-0.5">{station.code}</p>
                )}
              </div>
              <ChevronRight
                size={16}
                className="text-gray-400 flex-shrink-0 group-hover:text-blue-500 transition-colors"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
