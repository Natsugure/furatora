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
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import type { TransferPartnerDTO } from '@/features/station/domain/types';
import { assembleTransferPartners, type PartnerLine } from '@/features/station/domain/transferPartners';

// 駅詳細の乗換難易度（新モデル: 接続 → ルート → 設備）の読み取り。stationDetailQuery から呼ぶ。
// ここは SQL だけを持ち、組み立ては features/station/domain/transferPartners.ts の純関数に任せる。
// DTO はルートと設備をそのまま運び、ペルソナで絞らない（docs/domain/station-master-model.md「乗換難易度」）。
//
// 相手駅には publishedStation() を通さない（stationDetailQuery の getStationConnectionRows と同じ理由。
// リンクを生成しない表示用の情報だけを返す。docs/domain/station-visibility.md）。

const inboundDirections = alias(lineDirections, 'inbound_directions');
const outboundDirections = alias(lineDirections, 'outbound_directions');

// transfer_connections は端点を正規化順（A < B）で持つので、S が A 側・B 側の両方を見る
export async function getTransferConnectionRows(stationId: string) {
  return db
    .select()
    .from(transferConnections)
    .where(or(eq(transferConnections.stationAId, stationId), eq(transferConnections.stationBId, stationId)));
}

type ConnectionRow = Awaited<ReturnType<typeof getTransferConnectionRows>>[number];

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
          .where(inArray(connectionRoutes.connectionId, connectionIds))
          // assessRoutes は所要時分で安定ソートするので、同じ時分のルートの順序はここで決まる。
          // 順序が揺れると「最短のバリアフリールート」に添える必要な行為が再読み込みで入れ替わりうる。
          // label は接続内で一意（unique_connection_route_label）なので、これで順序が確定する
          .orderBy(asc(connectionRoutes.label)),
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

  return assembleTransferPartners({
    stationId,
    partnerLines,
    connectionRows,
    routeRows: linkRows,
    facilityRows,
    stationLineRows,
    platformRows,
    defaultDirectionRows,
  });
}
