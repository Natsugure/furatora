import { isFacilityTypeCode } from '@furatora/database/enums';
import {
  firstLineByStation,
  orientConnection,
  resolveStationDirectionLabels,
  type DirectionType,
  type FacilityTypeCode,
} from '@furatora/transfer-difficulty/domain';
import type { TransferComboDTO, TransferPartnerDTO, TransferRouteDTO } from './types';

// 駅詳細の乗換難易度（接続 → ルート → 設備）の組み立て（純関数・DB非依存）。
// 行の読み取りは external/query/transferPartnerRows.ts が行う。方面ラベルと接続の向きの規則は
// @furatora/transfer-difficulty/domain のものを使い、ここでは書き直さない（ADR-0015 決定2）。
// 入力の行型は構造的な最小型にし、external・schema の型に依存しない（ADR-0001）

/** 接続一覧（station_connections）の相手駅と、その路線 */
export type PartnerLine = Pick<
  TransferPartnerDTO,
  'connectedStationId' | 'connectedStationName' | 'lineName' | 'lineColor'
>;

// ルートごとの設備。稼働中のコードが知らない設備コードを含むルートは、設備を空（未入力）として扱う。
// DB の CHECK 制約は「最後にマイグレーションを流したビルドの定数」に従うだけなので、Admin や別ビルドが先に
// 新しいコードを保存すると、ここに届きうる（ADR-0016「残るずれ」）。表示だけで失うものは無いため、止めずに続ける。
// そのコードだけ捨てると残りの設備で判定され、段差のあるルートを「バリアフリールートあり」と出しうる。
// 未入力なら必要な行為を導出しない（ADR-0012）
export function facilitiesByRoute(
  rows: readonly { routeId: string; typeCode: string }[],
): Map<string, FacilityTypeCode[]> {
  const facilitiesOf = new Map<string, FacilityTypeCode[]>();
  const unknownRouteIds = new Set<string>();
  for (const row of rows) {
    if (!isFacilityTypeCode(row.typeCode)) {
      unknownRouteIds.add(row.routeId);
      continue;
    }
    const list = facilitiesOf.get(row.routeId) ?? [];
    list.push(row.typeCode);
    facilitiesOf.set(row.routeId, list);
  }
  for (const routeId of unknownRouteIds) facilitiesOf.set(routeId, []);
  return facilitiesOf;
}

export function assembleTransferPartners(input: {
  stationId: string;
  /** 未評価の相手駅もここから出す */
  partnerLines: readonly PartnerLine[];
  /** transfer_connections の行（端点は正規化順） */
  connectionRows: readonly {
    id: string;
    stationAId: string;
    directionA: DirectionType;
    stationBId: string;
    directionB: DirectionType;
    notes: string | null;
  }[];
  /** 接続に結んだルート。この並びが接続ごとのルートの並びになる */
  routeRows: readonly ({ connectionId: string } & Omit<TransferRouteDTO, 'facilities'>)[];
  facilityRows: readonly { routeId: string; typeCode: string }[];
  /** 駅の路線。lines.displayOrder, lines.id 順に並べてあること（firstLineByStation） */
  stationLineRows: readonly { stationId: string; lineId: string; lineName: string }[];
  /** 方面ラベルの ①: ホームの枠ごとの方面 */
  platformRows: readonly {
    stationId: string;
    lineId: string;
    platformNumber: string;
    inboundName: string | null;
    outboundName: string | null;
  }[];
  /** 方面ラベルの ②: 路線の既定行 */
  defaultDirectionRows: readonly { lineId: string; directionType: DirectionType; displayName: string }[];
}): TransferPartnerDTO[] {
  const { stationId } = input;

  const facilitiesOf = facilitiesByRoute(input.facilityRows);
  const routesOf = new Map<string, TransferRouteDTO[]>();
  for (const { connectionId, ...route } of input.routeRows) {
    const dto: TransferRouteDTO = { ...route, facilities: facilitiesOf.get(route.routeId) ?? [] };
    routesOf.set(connectionId, [...(routesOf.get(connectionId) ?? []), dto]);
  }

  // 相手駅の ID は uuid の大文字小文字が食い違いうるので、小文字をキーにする（orientConnection と同じ理由）
  const combosOf = new Map<string, TransferComboDTO[]>();
  for (const row of input.connectionRows) {
    const { connectedStationId, stationDirection, connectedDirection } = orientConnection(row, stationId);
    const key = connectedStationId.toLowerCase();
    const combo: TransferComboDTO = {
      stationDirection,
      connectedDirection,
      notes: row.notes,
      routes: routesOf.get(row.id) ?? [],
    };
    combosOf.set(key, [...(combosOf.get(key) ?? []), combo]);
  }

  const firstLineOf = firstLineByStation(input.stationLineRows);
  const directionLabelsOf = (id: string) =>
    resolveStationDirectionLabels({
      stationId: id,
      firstLineOf,
      platformRows: input.platformRows,
      defaultRows: input.defaultDirectionRows,
    });

  const stationDirectionLabels = directionLabelsOf(stationId);
  const stationLineName = firstLineOf.get(stationId)?.lineName ?? '';
  return input.partnerLines.map((p) => ({
    ...p,
    stationLineName,
    directionLabels: { station: stationDirectionLabels, connected: directionLabelsOf(p.connectedStationId) },
    combos: combosOf.get(p.connectedStationId.toLowerCase()) ?? [],
  }));
}
