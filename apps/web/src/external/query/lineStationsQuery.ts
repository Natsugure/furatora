import { db } from '@furatora/database/client';
import { stations, stationLines, lines } from '@furatora/database/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { Line, StationWithOrder } from '@/types';
import { publishedStation, visibleLine } from './visibility';

// `app/lines/[slug]/stations/page.tsx` と `/api/v1/lines/[slug]/stations` が共用する。
// 路線に visibleLine()（slug必須 + 公開駅を1件以上持つ）、
// 駅一覧に publishedStation() を通す。未公開駅を路線の下に並べない。
export async function getVisibleLineWithStations(
  slug: string,
): Promise<{ line: Line; stations: StationWithOrder[] } | null> {
  const [lineRecord] = await db
    .select()
    .from(lines)
    .where(and(eq(lines.slug, slug), visibleLine()))
    .limit(1);

  if (!lineRecord) {
    return null;
  }

  const stationsResult = await db
    .select({
      id: stations.id,
      slug: stations.slug,
      code: stations.code,
      name: stations.name,
      nameEn: stations.nameEn,
      lat: stations.lat,
      lon: stations.lon,
      stationOrder: stationLines.stationOrder,
    })
    .from(stationLines)
    .innerJoin(stations, eq(stationLines.stationId, stations.id))
    .where(and(eq(stationLines.lineId, lineRecord.id), publishedStation()))
    .orderBy(asc(stationLines.stationOrder));

  return {
    line: {
      id: lineRecord.id,
      slug: lineRecord.slug,
      name: lineRecord.name,
      nameEn: lineRecord.nameEn,
      lineCode: lineRecord.lineCode,
      color: lineRecord.color,
      displayOrder: lineRecord.displayOrder,
      operatorId: lineRecord.operatorId,
    },
    // slug は非 null（published_requires_slug の CHECK 制約により、
    // publishedStation() を通った行は必ず slug を持つ）
    stations: stationsResult.map((s) => ({ ...s, slug: s.slug! })),
  };
}
