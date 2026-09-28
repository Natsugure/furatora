import type { DirectionType } from '@furatora/database/enums';
import type { ComboKey } from './types';

export type TransferEndpoint = {
  stationId: string;
  directionType: DirectionType;
};

// 乗換接続（transferConnections）の端点 (stationId, direction_type) の昇順正規化。
//
// check(transfer_connection_endpoints_ordered) は (station_a_id, direction_a) <
// (station_b_id, direction_b) を要求し、逆順の行を拒否する。DB が拒否するので通し忘れは
// エラーになるが、書き込み側は INSERT 前に必ずこの正規化を通すこと。
// 読み取り側は端点の両順序（A,B）と（B,A）を見る必要がある。
//
// 【比較キーに directionType を含めること】stations が物理駅粒度に統合されると
// （Issue #82）stationId だけでは端点が定まらず、同一駅・方面違いの接続が正当になる。
//
// 【DB の順序と一致させる】PostgreSQL の uuid 比較はバイト順で、小文字16進の文字列順と
// 一致する。Zod の uuid は大文字も通すため、比較前に小文字化する。返す stationId は
// 入力のまま（大文字小文字を変えない）。'inbound' < 'outbound' は照合順序に依らず成立する。
//
// 両端点が等しい場合は x, y の順のまま返す（排除は DB の check と schema の責務）。
export function normalizeTransferEndpoints(
  x: TransferEndpoint,
  y: TransferEndpoint,
): { a: TransferEndpoint; b: TransferEndpoint } {
  return compareEndpoints(x, y) <= 0 ? { a: x, b: y } : { a: y, b: x };
}

function compareEndpoints(x: TransferEndpoint, y: TransferEndpoint): number {
  const xId = x.stationId.toLowerCase();
  const yId = y.stationId.toLowerCase();
  if (xId !== yId) return xId < yId ? -1 : 1;
  if (x.directionType !== y.directionType) return x.directionType < y.directionType ? -1 : 1;
  return 0;
}

export function comboKeyOf(stationDirection: DirectionType, connectedDirection: DirectionType): ComboKey {
  return `${stationDirection}:${connectedDirection}`;
}

// 方面の組み合わせ（S 基準）を、DB の正規化順（A < B）の端点対に変換する。
// 書き込み側が INSERT 前に必ず通すこと（check transfer_connection_endpoints_ordered が逆順を拒否する）
export function endpointsOfCombo(
  stationId: string,
  connectedStationId: string,
  combo: ComboKey,
): { a: TransferEndpoint; b: TransferEndpoint } {
  const [stationDirection, connectedDirection] = combo.split(':') as [DirectionType, DirectionType];
  return normalizeTransferEndpoints(
    { stationId, directionType: stationDirection },
    { stationId: connectedStationId, directionType: connectedDirection },
  );
}

// DB の接続行（端点は正規化順）を、S 基準の組み合わせに戻す。
// 【同一駅どうしの接続（#82 で正当になりうる）は扱わない】stationId の一致だけで A/B を判定する
export function comboOfConnection(
  row: { stationAId: string; directionA: DirectionType; stationBId: string; directionB: DirectionType },
  stationId: string,
): ComboKey {
  return row.stationAId.toLowerCase() === stationId.toLowerCase()
    ? comboKeyOf(row.directionA, row.directionB)
    : comboKeyOf(row.directionB, row.directionA);
}
