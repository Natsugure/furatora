import { db } from '@furatora/database/client';
import {
  connectionRoutes,
  facilityTypes,
  lineDirections,
  lines,
  stationConnections,
  stationLines,
  stations,
  transferConnections,
  transferRouteFacilities,
  transferRoutes,
} from '@furatora/database/schema';
import type { DirectionType } from '@furatora/database/enums';
import { FACILITY_TYPE_CODES, type FacilityTypeCode } from '@furatora/transfer-difficulty/domain';
import { and, asc, eq, inArray, not } from 'drizzle-orm';
import type {
  CandidateRoute,
  PairRouteRecord,
  TransferPairEditContext,
  TransferPairEditPageQuery,
} from '@/features/transfer-connection/ports';
import { comboOfConnection } from '@/features/transfer-connection/domain/draft';
import { pairConnectionCondition, touchesStationsCondition } from '@/external/transferPairSql';

// 駅対（自駅 S・相手駅 T）の乗換難易度の編集画面 1 枚ぶんの読み取り（ADR-0003。Query は画面ごとに1つ）。
// DTO はルートと設備をそのまま運び、ペルソナごとの必要な行為は含めない（導出は表示層。docs/domain）。

const isFacilityCode = (code: string): code is FacilityTypeCode =>
  (FACILITY_TYPE_CODES as readonly string[]).includes(code);

export const dbTransferPairEditPageQuery: TransferPairEditPageQuery = {
  async getContext(stationId, connectedStationId) {
    const [pair] = await db
      .select({ id: stationConnections.id })
      .from(stationConnections)
      .where(and(
        eq(stationConnections.stationId, stationId),
        eq(stationConnections.connectedStationId, connectedStationId),
      ));
    if (!pair) return null;

    const pairConnections = await db.select().from(transferConnections)
      .where(pairConnectionCondition(stationId, connectedStationId));
    const pairConnectionIds = pairConnections.map((c) => c.id);

    // この駅対の接続に結ばれた紐付け → ルート
    const pairLinks = pairConnectionIds.length === 0
      ? []
      : await db.select().from(connectionRoutes).where(inArray(connectionRoutes.connectionId, pairConnectionIds));
    const pairRouteIds = [...new Set(pairLinks.map((l) => l.routeId))];

    // S か T を端点に持つ、この駅対以外の接続（共有先と候補ルートの元）
    const nearbyConnections = await db.select().from(transferConnections).where(
      pairConnectionIds.length === 0
        ? touchesStationsCondition([stationId, connectedStationId])
        : and(
            touchesStationsCondition([stationId, connectedStationId]),
            not(inArray(transferConnections.id, pairConnectionIds)),
          ),
    );
    const nearbyLinks = nearbyConnections.length === 0
      ? []
      : await db.select().from(connectionRoutes)
          .where(inArray(connectionRoutes.connectionId, nearbyConnections.map((c) => c.id)));

    // 共有先の判定は「この駅対の外の接続」すべてが対象（S・T に触れない接続からの共有も拾う）
    const sharedLinks = pairRouteIds.length === 0
      ? []
      : pairConnectionIds.length === 0
        ? []
        : await db.select({
            routeId: connectionRoutes.routeId,
            connectionId: connectionRoutes.connectionId,
          })
          .from(connectionRoutes)
          .where(and(
            inArray(connectionRoutes.routeId, pairRouteIds),
            not(inArray(connectionRoutes.connectionId, pairConnectionIds)),
          ));
    const sharedConnectionIds = [...new Set(sharedLinks.map((l) => l.connectionId))];
    const sharedConnections = sharedConnectionIds.length === 0
      ? []
      : await db.select().from(transferConnections).where(inArray(transferConnections.id, sharedConnectionIds));

    const candidateRouteIds = [
      ...new Set(nearbyLinks.map((l) => l.routeId).filter((id) => !pairRouteIds.includes(id))),
    ];
    const allRouteIds = [...new Set([...pairRouteIds, ...candidateRouteIds])];
    const [routeRows, facilityRows] = allRouteIds.length === 0
      ? [[], []]
      : await Promise.all([
          db.select().from(transferRoutes).where(inArray(transferRoutes.id, allRouteIds)),
          db.select().from(transferRouteFacilities).where(inArray(transferRouteFacilities.routeId, allRouteIds)),
        ]);

    // 表示名の解決（駅名＋路線名）と補助表示の方面文言
    const stationIds = new Set<string>([stationId, connectedStationId]);
    for (const c of [...nearbyConnections, ...sharedConnections]) {
      stationIds.add(c.stationAId);
      stationIds.add(c.stationBId);
    }
    const [stationRows, stationLineRows, facilityTypeRows] = await Promise.all([
      db.select({ id: stations.id, name: stations.name }).from(stations).where(inArray(stations.id, [...stationIds])),
      db
        .select({ stationId: stationLines.stationId, lineId: lines.id, lineName: lines.name })
        .from(stationLines)
        .innerJoin(lines, eq(lines.id, stationLines.lineId))
        .where(inArray(stationLines.stationId, [...stationIds])),
      db.select({ code: facilityTypes.code, name: facilityTypes.name }).from(facilityTypes),
    ]);
    const stationName = new Map(stationRows.map((s) => [s.id, s.name]));
    const linesOf = new Map<string, { lineId: string; lineName: string }[]>();
    for (const row of stationLineRows) {
      const list = linesOf.get(row.stationId) ?? [];
      list.push({ lineId: row.lineId, lineName: row.lineName });
      linesOf.set(row.stationId, list);
    }
    const firstLineName = (id: string) => linesOf.get(id)?.[0]?.lineName ?? null;
    const label = (id: string) => {
      const name = stationName.get(id) ?? '（不明な駅）';
      const line = firstLineName(id);
      return line ? `${name}（${line}）` : name;
    };
    const connectionLabel = (c: { stationAId: string; stationBId: string }) =>
      `${label(c.stationAId)} ↔ ${label(c.stationBId)}`;

    const hints = async (id: string): Promise<Record<DirectionType, string[]>> => {
      const lineIds = (linesOf.get(id) ?? []).map((l) => l.lineId);
      const result: Record<DirectionType, string[]> = { inbound: [], outbound: [] };
      if (lineIds.length === 0) return result;
      const rows = await db
        .select({ directionType: lineDirections.directionType, displayName: lineDirections.displayName })
        .from(lineDirections)
        .where(inArray(lineDirections.lineId, lineIds))
        .orderBy(asc(lineDirections.displayName));
      for (const row of rows) {
        if (!result[row.directionType].includes(row.displayName)) result[row.directionType].push(row.displayName);
      }
      return result;
    };
    const [stationHints, connectedHints] = await Promise.all([hints(stationId), hints(connectedStationId)]);

    const facilitiesOf = new Map<string, FacilityTypeCode[]>();
    for (const row of facilityRows) {
      if (!isFacilityCode(row.typeCode)) continue;
      const list = facilitiesOf.get(row.routeId) ?? [];
      list.push(row.typeCode);
      facilitiesOf.set(row.routeId, list);
    }
    const routeById = new Map(routeRows.map((r) => [r.id, r]));
    const comboOfPairConnection = new Map(
      pairConnections.map((c) => [c.id, comboOfConnection(c, stationId)]),
    );
    const sharedConnectionById = new Map(sharedConnections.map((c) => [c.id, c]));

    const routes: PairRouteRecord[] = [];
    for (const routeId of pairRouteIds) {
      const route = routeById.get(routeId);
      if (!route) continue;
      const sharedWith = [
        ...new Map(
          sharedLinks
            .filter((l) => l.routeId === routeId)
            .map((l) => sharedConnectionById.get(l.connectionId))
            .filter((c): c is NonNullable<typeof c> => c !== undefined)
            .map((c) => {
              const value = { stationName: label(c.stationAId), connectedStationName: label(c.stationBId) };
              return [`${value.stationName}|${value.connectedStationName}`, value] as const;
            }),
        ).values(),
      ];
      routes.push({
        routeId,
        minutes: route.minutes,
        isOutdoor: route.isOutdoor,
        requiresExitGate: route.requiresExitGate,
        requiresStaff: route.requiresStaff,
        isOfficiallyGuided: route.isOfficiallyGuided,
        notes: route.notes,
        facilities: facilitiesOf.get(routeId) ?? [],
        links: pairLinks
          .filter((l) => l.routeId === routeId)
          .flatMap((l) => {
            const combo = comboOfPairConnection.get(l.connectionId);
            return combo ? [{ combo, label: l.label, isBaseline: l.isBaseline }] : [];
          }),
        sharedWith,
      });
    }

    const nearbyConnectionById = new Map(nearbyConnections.map((c) => [c.id, c]));
    const candidates: CandidateRoute[] = [];
    for (const routeId of candidateRouteIds) {
      const route = routeById.get(routeId);
      if (!route) continue;
      const links = nearbyLinks.filter((l) => l.routeId === routeId);
      const usedBy = [
        ...new Set(
          links
            .map((l) => nearbyConnectionById.get(l.connectionId))
            .filter((c): c is NonNullable<typeof c> => c !== undefined)
            .map(connectionLabel),
        ),
      ].join('、');
      candidates.push({
        routeId,
        label: links[0]?.label ?? '',
        minutes: route.minutes,
        isOutdoor: route.isOutdoor,
        requiresExitGate: route.requiresExitGate,
        requiresStaff: route.requiresStaff,
        isOfficiallyGuided: route.isOfficiallyGuided,
        notes: route.notes,
        facilities: facilitiesOf.get(routeId) ?? [],
        usedBy,
      });
    }

    const context: TransferPairEditContext = {
      stationId,
      connectedStationId,
      stationName: stationName.get(stationId) ?? '',
      connectedStationName: stationName.get(connectedStationId) ?? '',
      lineName: firstLineName(stationId),
      connectedLineName: firstLineName(connectedStationId),
      directionHints: { station: stationHints, connected: connectedHints },
      facilityTypes: facilityTypeRows
        .filter((row): row is { code: FacilityTypeCode; name: string } => isFacilityCode(row.code))
        .sort((x, y) => FACILITY_TYPE_CODES.indexOf(x.code) - FACILITY_TYPE_CODES.indexOf(y.code)),
      connections: pairConnections.map((c) => ({
        combo: comboOfConnection(c, stationId),
        connectionId: c.id,
        notes: c.notes,
        source: c.source,
      })),
      routes,
      candidates,
    };
    return context;
  },
};
