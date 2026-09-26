import { connectionRoutes, stationConnections, transferConnections, transferRoutes } from '@furatora/database/schema';
import type { Tx } from '@furatora/database/tx';
import { and, eq, inArray, notExists, or, sql } from 'drizzle-orm';

// 乗換難易度の駅対編集（Issue #124）で、Query と Repository が共有する SQL 部品。
// packages/database は web / scripts と共有のため、admin 都合のものは external/ にローカルで置く
// （ADR-0001。requireInserted.ts・pgError.ts と同じ方針）。

// 接続一覧（station_connections）の S→T 行。駅対の存在確認に使う
export function stationPairCondition(stationId: string, connectedStationId: string) {
  return and(
    eq(stationConnections.stationId, stationId),
    eq(stationConnections.connectedStationId, connectedStationId),
  );
}

// 駅対 {S, T} の接続。transfer_connections は端点を正規化順（A < B）で持つので、
// 読み取り側は両順序（A=S,B=T と A=T,B=S）を見る（docs/domain/station-master-model.md）
export function pairConnectionCondition(stationId: string, connectedStationId: string) {
  return or(
    and(eq(transferConnections.stationAId, stationId), eq(transferConnections.stationBId, connectedStationId)),
    and(eq(transferConnections.stationAId, connectedStationId), eq(transferConnections.stationBId, stationId)),
  );
}

// 駅 S か T のどちらかを端点に持つ接続。重複検出の候補ルート、および保存できる routeId の範囲
export function touchesStationsCondition(stationIds: string[]) {
  return or(
    inArray(transferConnections.stationAId, stationIds),
    inArray(transferConnections.stationBId, stationIds),
  );
}

// 接続に結ばれているルートの id（重複なし）。接続や紐付けを消す前に控え、deleteOrphanRoutes に渡す
export async function routeIdsOfConnections(tx: Tx, connectionIds: string[]): Promise<string[]> {
  if (connectionIds.length === 0) return [];
  const rows = await tx
    .selectDistinct({ routeId: connectionRoutes.routeId })
    .from(connectionRoutes)
    .where(inArray(connectionRoutes.connectionId, connectionIds));
  return rows.map((row) => row.routeId);
}

// どの接続からも参照されなくなったルートを削除する（設備は cascade で消える）。
// 【接続や紐付けを消す書き込みは、同じトランザクションで必ずこれを呼ぶこと】ルートは共有されうるため
// DB の cascade では消えない（docs/domain/station-master-model.md「不変条件」）
export async function deleteOrphanRoutes(tx: Tx, routeIds: string[]): Promise<void> {
  if (routeIds.length === 0) return;
  await tx.delete(transferRoutes).where(
    and(
      inArray(transferRoutes.id, routeIds),
      notExists(
        tx
          .select({ one: sql`1` })
          .from(connectionRoutes)
          .where(eq(connectionRoutes.routeId, transferRoutes.id)),
      ),
    ),
  );
}
