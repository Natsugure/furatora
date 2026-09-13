import { db } from '@furatora/database/client';
import {
  stations, platforms, lines, stationLines, stationConnections, lineDirections, facilityTypes,
} from '@furatora/database/schema';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { ConnectedStationOption } from '@/features/facility/ports';

// stationLayoutPageQuery が乗換可能な駅・設備種別の選択肢データとして再利用する
// Query Service。接続候補駅ごとに platforms/directions を1本ずつ投げるN+1を避け、
// 接続候補駅の集合に対して inArray で1本ずつ引き、アプリ側で駅ごとに畳む。
export async function getFacilityTypeOptions() {
  return db.select({ code: facilityTypes.code, name: facilityTypes.name }).from(facilityTypes);
}

export async function getConnectedStationOptions(stationId: string): Promise<ConnectedStationOption[]> {
  // 現行 GET /api/stations?connectedFrom= と同じ JOIN。
  const stationRows = await db
    .select({
      id: stations.id,
      name: stations.name,
      code: stations.code,
      lineId: lines.id,
      lineName: lines.name,
      lineColor: lines.color,
    })
    .from(stationConnections)
    .innerJoin(stations, eq(stationConnections.connectedStationId, stations.id))
    .leftJoin(stationLines, eq(stationLines.stationId, stations.id))
    .leftJoin(lines, eq(lines.id, stationLines.lineId))
    .where(and(
      eq(stationConnections.stationId, stationId),
      isNotNull(stationConnections.connectedStationId),
    ))
    .orderBy(asc(lines.name));

  if (stationRows.length === 0) return [];

  const connectedStationIds = [...new Set(stationRows.map((s) => s.id))];

  // 接続候補駅すべてのホームを1本で取得（駅ごとの往復をしない）
  const platformRows = await db
    .select({
      id: platforms.id,
      stationId: platforms.stationId,
      platformNumber: platforms.platformNumber,
      inboundDirectionId: platforms.inboundDirectionId,
      outboundDirectionId: platforms.outboundDirectionId,
    })
    .from(platforms)
    .where(inArray(platforms.stationId, connectedStationIds))
    .orderBy(asc(platforms.platformNumber));

  // 各駅のホームが参照する方面 ID を集め、方面の表示名を1本で解決する
  // （現行 GET /api/stations/{id}/directions のロジックと同じ）
  const directionIdsByStation = new Map<string, Set<string>>();
  for (const p of platformRows) {
    const set = directionIdsByStation.get(p.stationId) ?? new Set<string>();
    if (p.inboundDirectionId) set.add(p.inboundDirectionId);
    if (p.outboundDirectionId) set.add(p.outboundDirectionId);
    directionIdsByStation.set(p.stationId, set);
  }
  const allDirectionIds = [...new Set([...directionIdsByStation.values()].flatMap((s) => [...s]))];

  const directionRows = allDirectionIds.length > 0
    ? await db
        .select({ id: lineDirections.id, displayName: lineDirections.displayName })
        .from(lineDirections)
        .where(inArray(lineDirections.id, allDirectionIds))
    : [];
  const directionNameById = new Map(directionRows.map((d) => [d.id, d.displayName]));

  // 駅 ID で畳む。JOIN の結果は「駅×路線」の粒度なので、複数路線を持つ駅は
  // 同じ駅が複数行になる（stationConnections 側に同一 connectedStationId が
  // 複数あった場合も同様）。行のまま返すと接続候補リストに同じ駅が並び、
  // 両方チェックすると facility_connections の
  // unique(platformLocationId, connectedStationId) で保存に失敗する。
  // 出現順（lines.name 昇順）は保持する。
  const byStationId = new Map<string, ConnectedStationOption>();
  for (const row of stationRows) {
    let option = byStationId.get(row.id);
    if (!option) {
      option = {
        id: row.id,
        name: row.name,
        code: row.code,
        lines: [],
        platforms: platformRows
          .filter((p) => p.stationId === row.id)
          .map((p) => ({ id: p.id, platformNumber: p.platformNumber })),
        directions: [...(directionIdsByStation.get(row.id) ?? [])]
          .map((id) => ({ id, displayName: directionNameById.get(id) ?? '(不明な方面)' })),
      };
      byStationId.set(row.id, option);
    }
    // leftJoin なので路線を持たない駅では lineId が null になる
    if (row.lineId !== null && row.lineName !== null
        && !option.lines.some((l) => l.id === row.lineId)) {
      option.lines.push({ id: row.lineId, name: row.lineName, color: row.lineColor });
    }
  }

  return [...byStationId.values()];
}
