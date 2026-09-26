import { withTransaction } from '@furatora/database/tx';
import { stationConnections, transferConnections } from '@furatora/database/schema';
import { inArray, or } from 'drizzle-orm';
import type { StationConnectionRepository } from '@/features/station-connection/ports';
import {
  deleteOrphanRoutes,
  pairConnectionCondition,
  routeIdsOfConnections,
  stationPairCondition,
} from '@/external/transferPairSql';

// 乗換接続は有向2行で持つ（docs/domain/station-master-model.md「乗換接続」）。
// station_connections は接続一覧（乗換できる相手駅）で、乗換難易度は持たない。難易度は
// transfer_connections 以下の新モデルで、駅対の編集画面から入力する（#124）。
// 旧4列（strollerDifficulty 等）は #125 のあとの別デプロイで落とすまで残るが、ここからは書かない。

// createPair は両方向を1トランザクションで冪等に挿入する（ADR-0005）。
export const dbStationConnectionRepository: StationConnectionRepository = {
  async createPair(stationId, input) {
    const { connectedStationId } = input;

    await withTransaction(async (tx) => {
      await tx
        .insert(stationConnections)
        .values([
          { stationId, connectedStationId, source: 'manual' as const },
          { stationId: connectedStationId, connectedStationId: stationId, source: 'manual' as const },
        ])
        // unique_station_connection(station_id, connected_station_id) を衝突対象にする。
        .onConflictDoNothing({
          target: [stationConnections.stationId, stationConnections.connectedStationId],
        });
    });
  },

  // 【接続一覧の2行に加えて、その駅対の乗換難易度（transfer_connections 以下）と、孤立したルートも消す】
  // transfer_connections は station_connections への FK を持たず、ルートも cascade では消えないため
  // （docs/domain/station-master-model.md「乗換接続」「不変条件」）。1トランザクションで行う（ADR-0005）。
  async deletePair(stationId, connectedStationId) {
    return withTransaction(async (tx) => {
      const evaluated = await tx
        .select({ id: transferConnections.id })
        .from(transferConnections)
        .where(pairConnectionCondition(stationId, connectedStationId));
      const connectionIds = evaluated.map((c) => c.id);

      // 接続を消す前に、参照していたルートを控える（消したあとは辿れない）
      const routeIds = await routeIdsOfConnections(tx, connectionIds);
      if (connectionIds.length > 0) {
        await tx.delete(transferConnections).where(inArray(transferConnections.id, connectionIds));
      }

      const deleted = await tx
        .delete(stationConnections)
        .where(or(
          stationPairCondition(stationId, connectedStationId),
          stationPairCondition(connectedStationId, stationId),
        ))
        .returning({ id: stationConnections.id });

      await deleteOrphanRoutes(tx, routeIds);

      return deleted.length > 0;
    });
  },
};
