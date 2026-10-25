import type { StationDetailQuery } from '../ports';
import type { StationDetailView } from '../domain/types';
import { buildDirectionTabs } from '../domain/tabs';
import { sortPlatformsByNumber } from '../domain/platformOrder';

export function makeGetStationDetail(deps: { query: StationDetailQuery }) {
  return async (slug: string): Promise<StationDetailView | null> => {
    const detail = await deps.query.getBySlug(slug);
    if (!detail) return null;
    // タブが1つの駅では、ページはタブを使わず platforms を直接描く。どちらの経路でも番号順にするため、ここで並べる
    const platforms = sortPlatformsByNumber(detail.platforms);
    return { ...detail, platforms, tabs: buildDirectionTabs(platforms) };
  };
}
