import { db } from '@furatora/database/client';
import {
  connectionRoutes,
  facilityTypes,
  lineDirections,
  lines,
  platforms,
  stationConnections,
  stationLines,
  stations,
  transferConnections,
  transferRouteFacilities,
  transferRoutes,
} from '@furatora/database/schema';
import type { DirectionType } from '@furatora/database/enums';
import {
  FACILITY_TYPE_CODES,
  resolveDirectionLabel,
  type FacilityTypeCode,
} from '@furatora/transfer-difficulty/domain';
import { and, asc, eq, inArray, not } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  CandidateRoute,
  PairRouteRecord,
  TransferPairEditContext,
  TransferPairEditPageQuery,
} from '@/features/transfer-connection/ports';
import { comboOfConnection } from '@/features/transfer-connection/domain/normalize';
import { withLine } from '@/features/transfer-connection/domain/label';
import type { RouteBody } from '@/features/transfer-connection/domain/types';
import {
  pairConnectionCondition,
  stationPairCondition,
  touchesStationsCondition,
} from '@/external/transferPairSql';

// 駅対（自駅 S・相手駅 T）の乗換難易度の編集画面 1 枚ぶんの読み取り（ADR-0003。Query は画面ごとに1つ）。
// DTO はルートと設備をそのまま運び、ペルソナごとの必要な行為は含めない（導出は表示層。docs/domain）。

const isFacilityCode = (code: string): code is FacilityTypeCode =>
  (FACILITY_TYPE_CODES as readonly string[]).includes(code);

const inboundDirections = alias(lineDirections, 'inbound_directions');
const outboundDirections = alias(lineDirections, 'outbound_directions');

export const dbTransferPairEditPageQuery: TransferPairEditPageQuery = {
  async getContext(stationId, connectedStationId) {
    const pairCondition = pairConnectionCondition(stationId, connectedStationId);
    // neon-http は await ごとに HTTP 往復になるため、依存の無いものは Promise.all でまとめる
    const [[pair], pairConnections, nearbyConnections, facilityTypeRows, platformRows, defaultDirectionRows] = await Promise.all([
      db.select({ id: stationConnections.id }).from(stationConnections)
        .where(stationPairCondition(stationId, connectedStationId)),
      db.select().from(transferConnections).where(pairCondition),
      // S か T を端点に持つ、この駅対以外の接続（候補ルートの元）
      db.select().from(transferConnections).where(and(
        touchesStationsCondition([stationId, connectedStationId]),
        pairCondition && not(pairCondition),
      )),
      db.select({ code: facilityTypes.code, name: facilityTypes.name }).from(facilityTypes),
      // 方面の文言の ①: ホームの枠ごとの方面（ADR-0014）
      db
        .select({
          stationId: platforms.stationId,
          lineId: platforms.lineId,
          inboundName: inboundDirections.displayName,
          outboundName: outboundDirections.displayName,
        })
        .from(platforms)
        .leftJoin(inboundDirections, eq(inboundDirections.id, platforms.inboundDirectionId))
        .leftJoin(outboundDirections, eq(outboundDirections.id, platforms.outboundDirectionId))
        .where(inArray(platforms.stationId, [stationId, connectedStationId]))
        .orderBy(asc(platforms.platformNumber)),
      // 方面の文言の ②: 路線の既定行
      db
        .select({
          lineId: lineDirections.lineId,
          directionType: lineDirections.directionType,
          displayName: lineDirections.displayName,
        })
        .from(lineDirections)
        .innerJoin(stationLines, eq(stationLines.lineId, lineDirections.lineId))
        .where(and(
          inArray(stationLines.stationId, [stationId, connectedStationId]),
          eq(lineDirections.isDefault, true),
        )),
    ]);
    if (!pair) return null;

    const pairConnectionIds = pairConnections.map((c) => c.id);
    const nearbyConnectionIds = nearbyConnections.map((c) => c.id);
    const [pairLinks, nearbyLinks] = await Promise.all([
      pairConnectionIds.length === 0
        ? []
        : db.select().from(connectionRoutes).where(inArray(connectionRoutes.connectionId, pairConnectionIds)),
      nearbyConnectionIds.length === 0
        ? []
        : db.select().from(connectionRoutes).where(inArray(connectionRoutes.connectionId, nearbyConnectionIds)),
    ]);
    const pairRouteIds = [...new Set(pairLinks.map((l) => l.routeId))];
    const candidateRouteIds = [
      ...new Set(nearbyLinks.map((l) => l.routeId).filter((id) => !pairRouteIds.includes(id))),
    ];
    const allRouteIds = [...pairRouteIds, ...candidateRouteIds];

    const [sharedLinks, routeRows, facilityRows] = await Promise.all([
      // 共有先の判定は「この駅対の外の接続」すべてが対象（S・T に触れない接続からの共有も拾う）
      pairRouteIds.length === 0
        ? []
        : db
            .select({
              routeId: connectionRoutes.routeId,
              stationAId: transferConnections.stationAId,
              stationBId: transferConnections.stationBId,
            })
            .from(connectionRoutes)
            .innerJoin(transferConnections, eq(transferConnections.id, connectionRoutes.connectionId))
            .where(and(
              inArray(connectionRoutes.routeId, pairRouteIds),
              not(inArray(connectionRoutes.connectionId, pairConnectionIds)),
            )),
      allRouteIds.length === 0
        ? []
        : db.select().from(transferRoutes).where(inArray(transferRoutes.id, allRouteIds)),
      allRouteIds.length === 0
        ? []
        : db.select().from(transferRouteFacilities).where(inArray(transferRouteFacilities.routeId, allRouteIds)),
    ]);

    // 表示名の解決（駅名＋路線名）
    const stationIds = new Set<string>([stationId, connectedStationId]);
    for (const c of [...nearbyConnections, ...sharedLinks]) {
      stationIds.add(c.stationAId);
      stationIds.add(c.stationBId);
    }
    const [stationRows, stationLineRows] = await Promise.all([
      db.select({ id: stations.id, name: stations.name }).from(stations).where(inArray(stations.id, [...stationIds])),
      db
        .select({ stationId: stationLines.stationId, lineId: stationLines.lineId, lineName: lines.name })
        .from(stationLines)
        .innerJoin(lines, eq(lines.id, stationLines.lineId))
        .where(inArray(stationLines.stationId, [...stationIds])),
    ]);
    const stationName = new Map(stationRows.map((s) => [s.id, s.name]));
    const firstLineOf = new Map<string, { lineId: string; lineName: string }>();
    for (const row of stationLineRows) {
      if (!firstLineOf.has(row.stationId)) firstLineOf.set(row.stationId, { lineId: row.lineId, lineName: row.lineName });
    }
    const firstLineName = (id: string) => firstLineOf.get(id)?.lineName ?? null;
    const label = (id: string) => withLine(stationName.get(id) ?? '（不明な駅）', firstLineName(id));
    const connectionLabel = (c: { stationAId: string; stationBId: string }) =>
      `${label(c.stationAId)} ↔ ${label(c.stationBId)}`;

    // 入力の補助表示の方面文言。駅名・路線名の表示と同じく、駅の最初の路線について解決する。
    // 路線で絞るのは、1駅が複数路線を持つようになったとき（#82）に別路線の文言が混ざらないようにするため
    const hints = (id: string): Record<DirectionType, string> => {
      const lineId = firstLineOf.get(id)?.lineId;
      const platformsOfLine = platformRows.filter((p) => p.stationId === id && p.lineId === lineId);
      const resolve = (directionType: DirectionType, platformNames: (string | null)[]) =>
        resolveDirectionLabel({
          directionType,
          platformNames: platformNames.filter((name): name is string => name !== null),
          defaultName: defaultDirectionRows.find(
            (d) => d.lineId === lineId && d.directionType === directionType,
          )?.displayName ?? null,
        }).label;
      return {
        inbound: resolve('inbound', platformsOfLine.map((p) => p.inboundName)),
        outbound: resolve('outbound', platformsOfLine.map((p) => p.outboundName)),
      };
    };

    const facilitiesOf = new Map<string, FacilityTypeCode[]>();
    for (const row of facilityRows) {
      if (!isFacilityCode(row.typeCode)) continue;
      const list = facilitiesOf.get(row.routeId) ?? [];
      list.push(row.typeCode);
      facilitiesOf.set(row.routeId, list);
    }
    const routeById = new Map(routeRows.map((r) => [r.id, r]));
    const routeBody = (route: (typeof routeRows)[number]): RouteBody => ({
      minutes: route.minutes,
      isOutdoor: route.isOutdoor,
      requiresExitGate: route.requiresExitGate,
      requiresStaff: route.requiresStaff,
      isOfficiallyGuided: route.isOfficiallyGuided,
      notes: route.notes,
      facilities: facilitiesOf.get(route.id) ?? [],
    });
    const comboOfPairConnection = new Map(
      pairConnections.map((c) => [c.id, comboOfConnection(c, stationId)]),
    );
    const routes: PairRouteRecord[] = [];
    for (const routeId of pairRouteIds) {
      const route = routeById.get(routeId);
      if (!route) continue;
      const sharedWith = [
        ...new Map(
          sharedLinks
            .filter((l) => l.routeId === routeId)
            .map((c) => {
              const value = { stationName: label(c.stationAId), connectedStationName: label(c.stationBId) };
              return [`${value.stationName}|${value.connectedStationName}`, value] as const;
            }),
        ).values(),
      ];
      routes.push({
        ...routeBody(route),
        routeId,
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
        ...routeBody(route),
        label: links[0]?.label ?? '',
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
      directionHints: { station: hints(stationId), connected: hints(connectedStationId) },
      facilityTypes: facilityTypeRows
        .filter((row): row is { code: FacilityTypeCode; name: string } => isFacilityCode(row.code))
        .sort((x, y) => FACILITY_TYPE_CODES.indexOf(x.code) - FACILITY_TYPE_CODES.indexOf(y.code)),
      connections: pairConnections.map((c) => ({ combo: comboOfConnection(c, stationId), notes: c.notes })),
      routes,
      candidates,
    };
    return context;
  },
};
