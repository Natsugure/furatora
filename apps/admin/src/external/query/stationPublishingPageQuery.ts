import { db } from '@furatora/database/client';
import {
  stations, stationLines, lines, stationFacilities, platformLocationCells,
  platformLocations, platforms, facilityTypes,
} from '@furatora/database/schema';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { StationPublishingPageQuery } from '@/features/station-publishing/ports';
import { LINE_SLUG_ORDER_BY } from '@/external/repository/stationPublishingRepository';

// 設備の入力状況は「入力済みの設備タイプ数 / facilityTypes の総数」で示す。
// 公開条件にはしない確認材料である（design.md「設備充足度を公開条件にしない判断」）。
async function countFacilityInput(stationId: string): Promise<{ input: number; total: number }> {
  const [inputRow, totalRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(distinct ${stationFacilities.typeCode})` })
      .from(stationFacilities)
      .innerJoin(platformLocationCells, eq(platformLocationCells.id, stationFacilities.platformLocationCellId))
      .innerJoin(platformLocations, eq(platformLocations.id, platformLocationCells.platformLocationId))
      .innerJoin(platforms, eq(platforms.id, platformLocations.platformId))
      .where(eq(platforms.stationId, stationId)),
    db.select({ count: sql<number>`count(*)` }).from(facilityTypes),
  ]);
  return {
    input: Number(inputRow[0]?.count ?? 0),
    total: Number(totalRow[0]?.count ?? 0),
  };
}

export const dbStationPublishingPageQuery: StationPublishingPageQuery = {
  async getContext(stationId) {
    const [stationRow] = await db.select().from(stations).where(eq(stations.id, stationId)).limit(1);
    if (!stationRow) return null;

    // 駅が複数路線を持つ場合（実測5駅）は「slug を持つ路線」を優先して1件表示する。
    // stationPublishingRepository.findLineSlug と同じ ORDER BY を使うこと（LINE_SLUG_ORDER_BY）。
    // ここでの表示と publish API の検証が別々の路線を見ると公開ゲートが食い違う。
    const [lineRow] = await db
      .select({ id: lines.id, name: lines.name, slug: lines.slug })
      .from(stationLines)
      .innerJoin(lines, eq(lines.id, stationLines.lineId))
      .where(eq(stationLines.stationId, stationId))
      .orderBy(LINE_SLUG_ORDER_BY)
      .limit(1);

    const facility = await countFacilityInput(stationId);

    return {
      station: {
        id: stationRow.id,
        name: stationRow.name,
        nameKana: stationRow.nameKana,
        nameEn: stationRow.nameEn,
        slug: stationRow.slug,
        publishedAt: stationRow.publishedAt,
      },
      line: lineRow ?? null,
      facilityInputCount: facility.input,
      facilityTypeCount: facility.total,
    };
  },

  async listLinesMissingSlug() {
    const rows = await db
      .select({
        lineId: lines.id,
        lineName: lines.name,
        publishedStationCount: sql<number>`count(distinct ${stations.id})`,
      })
      .from(lines)
      .innerJoin(stationLines, eq(stationLines.lineId, lines.id))
      .innerJoin(stations, eq(stations.id, stationLines.stationId))
      .where(and(isNull(lines.slug), isNotNull(stations.publishedAt)))
      .groupBy(lines.id, lines.name);

    return rows.map((r) => ({
      lineId: r.lineId,
      lineName: r.lineName,
      publishedStationCount: Number(r.publishedStationCount),
    }));
  },
};
