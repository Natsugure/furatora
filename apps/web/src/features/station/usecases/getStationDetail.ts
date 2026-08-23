import type { StationDetailQuery } from '../ports';
import type { StationDetailView } from '../domain/types';
import { buildDirectionTabs } from '../domain/tabs';

export function makeGetStationDetail(deps: { query: StationDetailQuery }) {
  return async (slug: string): Promise<StationDetailView | null> => {
    const detail = await deps.query.getBySlug(slug);
    if (!detail) return null;
    return { ...detail, tabs: buildDirectionTabs(detail.platforms) };
  };
}
