import { db } from '@furatora/database/client';
import { stations, stationLines, lines } from '@furatora/database/schema';
import { ilike, eq, and, or } from 'drizzle-orm';
import type { StationGroup } from '@/types';
import { publishedStation } from './visibility';

// /api/v1/stations（駅名検索）。
// stationLines・lines を LEFT JOIN し、駅名と路線情報を一括取得する。
// 同一物理駅が複数の路線レコードを持つ場合、行数が増えるため limit は多めに設定する。
export async function searchVisibleStations(query: string): Promise<StationGroup[]> {
  const rows = await db
    .select({
      id: stations.id,
      slug: stations.slug,
      code: stations.code,
      name: stations.name,
      nameEn: stations.nameEn,
      lat: stations.lat,
      lon: stations.lon,
      lineId: stationLines.lineId,
      lineName: lines.name,
      lineCode: lines.lineCode,
      lineColor: lines.color,
      lineSlug: lines.slug,
    })
    .from(stations)
    .leftJoin(stationLines, eq(stationLines.stationId, stations.id))
    .leftJoin(lines, eq(lines.id, stationLines.lineId))
    .where(and(
      publishedStation(),
      or(
        ilike(stations.name, `%${query}%`),
        ilike(stations.nameKana, `%${query}%`),
      ),
    ))
    .limit(60);

  // 駅名でグループ化（Map は挿入順を保持するため表示順が安定する）
  const groupMap = new Map<string, StationGroup>();

  for (const row of rows) {
    if (!groupMap.has(row.name)) {
      groupMap.set(row.name, {
        name: row.name,
        nameEn: row.nameEn,
        stations: [],
      });
    }
    groupMap.get(row.name)!.stations.push({
      id: row.id,
      // slug は非 null（published_requires_slug の CHECK 制約により、
      // publishedStation() を通った行は必ず slug を持つ）
      slug: row.slug!,
      code: row.code,
      lineId: row.lineId ?? null,
      lineName: row.lineName ?? null,
      lineCode: row.lineCode ?? null,
      lineColor: row.lineColor ?? null,
      lineSlug: row.lineSlug ?? null,
    });
  }

  return [...groupMap.values()].slice(0, 20);
}
