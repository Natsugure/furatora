'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import type { StationGroup, StationSearchApiResponse } from '@/types';

const cardClassName = 'bg-surface rounded-card border border-line shadow-card';
const statusCardClassName = `${cardClassName} px-4 py-5 text-sm`;

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
          size={22}
          strokeWidth={2.2}
          className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-600 pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHasError(false); }}
          placeholder="駅名で検索（例：茅場町）"
          aria-label="駅名"
          className="w-full h-14.5 pl-14 pr-5 rounded-[18px] bg-surface shadow-card text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </div>

      {/* 検索結果 */}
      {showResults && (
        <div className="mt-3 space-y-3">
          {loading && displayedGroups.length === 0 ? (
            <div className={`${statusCardClassName} flex flex-col items-center gap-2 text-muted`}>
              <Loader2 size={20} className="animate-spin text-brand-400" />
              <span>検索中…</span>
            </div>
          ) : hasError ? (
            <div className={`${statusCardClassName} text-center text-ink-soft`}>
              検索中にエラーが発生しました。しばらくしてから再度お試しください。
            </div>
          ) : displayedGroups.length === 0 ? (
            <div className={`${statusCardClassName} text-center text-muted`}>
              「{debouncedQuery}」に一致する駅が見つかりませんでした
            </div>
          ) : (
            <>
              {loading && (
                <div className="flex justify-center py-1">
                  <Loader2 size={16} className="animate-spin text-muted" />
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
    <div className={`${cardClassName} overflow-hidden`}>
      <div className="px-4 pt-3 pb-2">
        <p className="font-display font-bold text-base text-ink">{group.name}</p>
        {group.nameEn && (
          <p className="text-xs text-muted mt-0.5">{group.nameEn}</p>
        )}
      </div>
      <div className="border-t border-line">
        {group.stations.map((station) => (
          <Link
            key={station.id}
            href={`/stations/${station.slug}`}
          >
            <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 transition-colors group">
              <div
                className="w-1 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: station.lineColor || 'var(--color-rail-line-fallback)' }}
              />
              <div className="flex-1 min-w-0">
                {/* 路線色は縦線だけに使う。文字に使うと銀座線などで白地とのコントラストが足りない */}
                <p className="text-sm font-medium leading-tight text-ink">
                  {station.lineName ?? '不明な路線'}
                </p>
                {station.code && (
                  <p className="text-xs text-muted mt-0.5">{station.code}</p>
                )}
              </div>
              <ChevronRight
                size={16}
                className="text-muted flex-shrink-0 group-hover:text-brand-600 transition-colors"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
