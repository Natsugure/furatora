import { db } from '@furatora/database/client';
import { stations } from '@furatora/database/schema';
import { and, eq } from 'drizzle-orm';
import { publishedStation } from './visibility';

// /api/v1/stations/[id]。
// 単体取得APIも可視性の述語を通す。これが無いと、未公開駅の UUID を知っていれば
// 誰でも読めてしまう（docs/domain/station-visibility.md「読み取り経路（apps/web）」）。
export async function getVisibleStationById(id: string) {
  const [row] = await db
    .select()
    .from(stations)
    .where(and(eq(stations.id, id), publishedStation()))
    .limit(1);

  return row ?? null;
}
