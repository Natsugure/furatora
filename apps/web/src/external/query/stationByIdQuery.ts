import { db } from '@furatora/database/client';
import { stations } from '@furatora/database/schema';
import { and, eq } from 'drizzle-orm';
import { publishedStation } from './visibility';

// /api/v1/stations/[id]。
// 旧実装は `eq(stations.id, id)` のみで可視性の判定が無く、
// 未公開駅の UUID を知っていれば誰でも読めた（design.md「現行の可視性ガードは一覧にしか無い」）。
export async function getVisibleStationById(id: string) {
  const [row] = await db
    .select()
    .from(stations)
    .where(and(eq(stations.id, id), publishedStation()))
    .limit(1);

  return row ?? null;
}
