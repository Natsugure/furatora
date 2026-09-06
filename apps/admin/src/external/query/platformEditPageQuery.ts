import { db } from '@furatora/database/client';
import { stations, platforms, lines, lineDirections } from '@furatora/database/schema';
import { and, asc, eq } from 'drizzle-orm';
import type {
  PlatformEditPageQuery, PlatformEditContext, LineWithDirections,
} from '@/features/platform/ports';

// admin 全体の Query Service 化は #48。ここは #49 で先行導入したもの。
//
// 方面を路線にネストして返す。PlatformForm はこれにより路線切替時の
// fetch（/api/lines/{id}/directions）とレースが不要になる（#49 / #32）。

async function getLinesWithDirections(): Promise<LineWithDirections[]> {
  const [lineRows, directionRows] = await Promise.all([
    db.select({ id: lines.id, name: lines.name }).from(lines).orderBy(asc(lines.displayOrder)),
    db
      .select({
        id: lineDirections.id,
        lineId: lineDirections.lineId,
        directionType: lineDirections.directionType,
        displayName: lineDirections.displayName,
      })
      .from(lineDirections)
      .orderBy(asc(lineDirections.directionType)),
  ]);

  return lineRows.map((line) => {
    const forLine = directionRows.filter((d) => d.lineId === line.id);
    return {
      id: line.id,
      name: line.name,
      inboundDirections: forLine
        .filter((d) => d.directionType === 'inbound')
        .map((d) => ({ id: d.id, displayName: d.displayName })),
      outboundDirections: forLine
        .filter((d) => d.directionType === 'outbound')
        .map((d) => ({ id: d.id, displayName: d.displayName })),
    };
  });
}

export const dbPlatformEditPageQuery: PlatformEditPageQuery = {
  async getCreateContext(stationId) {
    const [station] = await db.select({ name: stations.name }).from(stations).where(eq(stations.id, stationId));
    if (!station) return null;

    const linesWithDirections = await getLinesWithDirections();
    return { stationName: station.name, lines: linesWithDirections };
  },

  async getEditContext(stationId, platformId) {
    const [station] = await db.select({ name: stations.name }).from(stations).where(eq(stations.id, stationId));
    if (!station) return null;

    const [platform] = await db
      .select()
      .from(platforms)
      .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)));
    if (!platform) return null;

    const linesWithDirections = await getLinesWithDirections();

    const context: PlatformEditContext = {
      stationName: station.name,
      lines: linesWithDirections,
      platform: {
        id: platform.id,
        platformNumber: platform.platformNumber,
        lineId: platform.lineId,
        inboundDirectionId: platform.inboundDirectionId,
        outboundDirectionId: platform.outboundDirectionId,
        physicalLength: Number(platform.physicalLength),
        platformSide: platform.platformSide ?? null,
        notes: platform.notes ?? '',
      },
    };
    return context;
  },
};
