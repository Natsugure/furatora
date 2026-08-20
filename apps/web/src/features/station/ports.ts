import type { StationDetailDTO } from './domain/types';

// Drizzle も Next.js も import しない（ADR-0002）。
// port は実在する画面（駅詳細ページ）に対してのみ定義する。
export interface StationDetailQuery {
  getBySlug(slug: string): Promise<StationDetailDTO | null>;
}
