import { db } from '@furatora/database/client';
import {
  connectionRoutes,
  lineDirections,
  lines,
  platforms,
  stationLines,
  transferConnections,
  transferRouteFacilities,
  transferRoutes,
} from '@furatora/database/schema';
import {
  FACILITY_TYPE_CODES,
  resolveDirectionLabel,
  type DirectionType,
  type FacilityTypeCode,
} from '@furatora/transfer-difficulty/domain';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import type { TransferComboDTO, TransferPartnerDTO, TransferRouteDTO } from '@/features/station/domain/types';

// 駅詳細の乗換難易度（新モデル: 接続 → ルート → 設備）の読み取り。stationDetailQuery から呼ぶ。
// DTO はルートと設備をそのまま運び、ペルソナで絞らない（docs/domain/station-master-model.md「乗換難易度」）。
//
// 相手駅には publishedStation() を通さない（stationDetailQuery の getStationConnectionRows と同じ理由。
// リンクを生成しない表示用の情報だけを返す。docs/domain/station-visibility.md）。

const inboundDirections = alias(lineDirections, 'inbound_directions');
const outboundDirections = alias(lineDirections, 'outbound_directions');

const isFacilityCode = (code: string): code is FacilityTypeCode =>
  (FACILITY_TYPE_CODES as readonly string[]).includes(code);

// transfer_connections は端点を正規化順（A < B）で持つので、S が A 側・B 側の両方を見る
export async function getTransferConnectionRows(stationId: string) {
  return db
    .select()
    .from(transferConnections)
    .where(or(eq(transferConnections.stationAId, stationId), eq(transferConnections.stationBId, stationId)));
}

type ConnectionRow = Awaited<ReturnType<typeof getTransferConnectionRows>>[number];

/** 接続一覧（station_connections）の相手駅と、その路線 */
export type PartnerLine = Pick<
  TransferPartnerDTO,
  'connectedStationId' | 'connectedStationName' | 'lineName' | 'lineColor'
>;

// 接続行を S から見た向きに直す。uuid の大文字小文字の違いで取り違えないよう小文字で比べる
// （apps/admin の comboOfConnection と同じ規則）
function orient(row: ConnectionRow, stationId: string) {
  const stationIsA = row.stationAId.toLowerCase() === stationId.toLowerCase();
  return stationIsA
    ? { connectedStationId: row.stationBId, stationDirection: row.directionA, connectedDirection: row.directionB }
    : { connectedStationId: row.stationAId, stationDirection: row.directionB, connectedDirection: row.directionA };
}

export async function buildTransferPartners(
  stationId: string,
  // 未評価の相手駅もここから出す
  partnerLines: PartnerLine[],
  connectionRows: ConnectionRow[],
): Promise<TransferPartnerDTO[]> {
  if (partnerLines.length === 0) return [];

  const connectionIds = connectionRows.map((c) => c.id);
  const stationIds = [...new Set([stationId, ...partnerLines.map((p) => p.connectedStationId)])];
  // neon-http は await ごとに HTTP 往復になるため、依存の無いものは Promise.all でまとめる
  const [linkRows, facilityRows, stationLineRows, platformRows, defaultDirectionRows] = await Promise.all([
    connectionIds.length === 0
      ? []
      : db
          .select({
            connectionId: connectionRoutes.connectionId,
            routeId: connectionRoutes.routeId,
            label: connectionRoutes.label,
            isBaseline: connectionRoutes.isBaseline,
            minutes: transferRoutes.minutes,
            isOutdoor: transferRoutes.isOutdoor,
            requiresExitGate: transferRoutes.requiresExitGate,
            requiresStaff: transferRoutes.requiresStaff,
            isOfficiallyGuided: transferRoutes.isOfficiallyGuided,
            notes: transferRoutes.notes,
          })
          .from(connectionRoutes)
          .innerJoin(transferRoutes, eq(transferRoutes.id, connectionRoutes.routeId))
          .where(inArray(connectionRoutes.connectionId, connectionIds)),
    connectionIds.length === 0
      ? []
      : db
          .selectDistinct({ routeId: transferRouteFacilities.routeId, typeCode: transferRouteFacilities.typeCode })
          .from(transferRouteFacilities)
          .innerJoin(connectionRoutes, eq(connectionRoutes.routeId, transferRouteFacilities.routeId))
          .where(inArray(connectionRoutes.connectionId, connectionIds)),
    db
      .select({ stationId: stationLines.stationId, lineId: stationLines.lineId, lineName: lines.name })
      .from(stationLines)
      .innerJoin(lines, eq(lines.id, stationLines.lineId))
      .where(inArray(stationLines.stationId, stationIds))
      // 「駅の最初の路線」を決める（apps/admin の transferPairEditPageQuery と同じ順序）
      .orderBy(asc(lines.displayOrder), asc(lines.id)),
    // 方面ラベルの ①: ホームの枠ごとの方面（ADR-0014 / docs/domain/line-directions.md）
    db
      .select({
        stationId: platforms.stationId,
        lineId: platforms.lineId,
        platformNumber: platforms.platformNumber,
        inboundName: inboundDirections.displayName,
        outboundName: outboundDirections.displayName,
      })
      .from(platforms)
      .leftJoin(inboundDirections, eq(inboundDirections.id, platforms.inboundDirectionId))
      .leftJoin(outboundDirections, eq(outboundDirections.id, platforms.outboundDirectionId))
      .where(inArray(platforms.stationId, stationIds)),
    // 方面ラベルの ②: 路線の既定行
    db
      .select({
        lineId: lineDirections.lineId,
        directionType: lineDirections.directionType,
        displayName: lineDirections.displayName,
      })
      .from(lineDirections)
      .innerJoin(stationLines, eq(stationLines.lineId, lineDirections.lineId))
      .where(and(inArray(stationLines.stationId, stationIds), eq(lineDirections.isDefault, true))),
  ]);

  const firstLineOf = new Map<string, { lineId: string; lineName: string }>();
  for (const row of stationLineRows) {
    if (!firstLineOf.has(row.stationId)) firstLineOf.set(row.stationId, { lineId: row.lineId, lineName: row.lineName });
  }

  // 駅は現在1駅1路線なので、駅の最初の路線について解決する。路線で絞るのは、1駅が複数路線を持つように
  // なったとき（#82）に別路線の文言が混ざらないようにするため
  const directionLabelsOf = (id: string): Record<DirectionType, string> => {
    const lineId = firstLineOf.get(id)?.lineId;
    // ホーム番号は varchar なので、SQL の並びでは '10' が '2' より前になる。数値として並べる
    const platformsOfLine = platformRows
      .filter((p) => p.stationId === id && p.lineId === lineId)
      .sort((a, b) => a.platformNumber.localeCompare(b.platformNumber, 'ja', { numeric: true }));
    const resolve = (directionType: DirectionType, names: (string | null)[]) =>
      resolveDirectionLabel({
        directionType,
        platformNames: names.filter((name): name is string => name !== null),
        defaultName:
          defaultDirectionRows.find((d) => d.lineId === lineId && d.directionType === directionType)?.displayName ??
          null,
      }).label;
    return {
      inbound: resolve('inbound', platformsOfLine.map((p) => p.inboundName)),
      outbound: resolve('outbound', platformsOfLine.map((p) => p.outboundName)),
    };
  };

  const facilitiesOf = new Map<string, FacilityTypeCode[]>();
  for (const row of facilityRows) {
    if (!isFacilityCode(row.typeCode)) continue;
    facilitiesOf.set(row.routeId, [...(facilitiesOf.get(row.routeId) ?? []), row.typeCode]);
  }
  const routesOf = new Map<string, TransferRouteDTO[]>();
  for (const { connectionId, ...route } of linkRows) {
    const dto: TransferRouteDTO = { ...route, facilities: facilitiesOf.get(route.routeId) ?? [] };
    routesOf.set(connectionId, [...(routesOf.get(connectionId) ?? []), dto]);
  }

  const combosOf = new Map<string, TransferComboDTO[]>();
  for (const row of connectionRows) {
    const { connectedStationId, stationDirection, connectedDirection } = orient(row, stationId);
    const key = connectedStationId.toLowerCase();
    const combo: TransferComboDTO = {
      stationDirection,
      connectedDirection,
      notes: row.notes,
      routes: routesOf.get(row.id) ?? [],
    };
    combosOf.set(key, [...(combosOf.get(key) ?? []), combo]);
  }

  const stationDirectionLabels = directionLabelsOf(stationId);
  const stationLineName = firstLineOf.get(stationId)?.lineName ?? '';
  return partnerLines.map((p) => ({
    ...p,
    stationLineName,
    directionLabels: { station: stationDirectionLabels, connected: directionLabelsOf(p.connectedStationId) },
    combos: combosOf.get(p.connectedStationId.toLowerCase()) ?? [],
  }));
}
