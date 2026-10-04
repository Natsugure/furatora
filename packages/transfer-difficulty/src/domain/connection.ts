// 乗換接続（transfer_connections）の行を、自駅 S から見た向きに直す。
//
// 端点は正規化順（A < B）で格納されるので、S は A 側にも B 側にもなりうる（docs/domain/station-master-model.md）。
// 【uuid は小文字で比べる】Zod の uuid は大文字も通すため、入力の大文字小文字が DB と食い違いうる。
// 返す駅 ID は入力のまま（大文字小文字を変えない）。
// 【同一駅どうしの接続（#82 で正当になりうる）は扱わない】stationId の一致だけで A/B を判定する

import type { DirectionType } from '@furatora/database/enums';

export function orientConnection(
  row: { stationAId: string; directionA: DirectionType; stationBId: string; directionB: DirectionType },
  stationId: string,
): { connectedStationId: string; stationDirection: DirectionType; connectedDirection: DirectionType } {
  return row.stationAId.toLowerCase() === stationId.toLowerCase()
    ? { connectedStationId: row.stationBId, stationDirection: row.directionA, connectedDirection: row.directionB }
    : { connectedStationId: row.stationAId, stationDirection: row.directionB, connectedDirection: row.directionA };
}
