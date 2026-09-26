import {
  connectionRoutes,
  stationConnections,
  transferConnections,
  transferRouteFacilities,
  transferRoutes,
} from '@furatora/database/schema';
import { withTransaction, type Tx } from '@furatora/database/tx';
import { and, eq, inArray } from 'drizzle-orm';
import {
  RouteLabelTakenError,
  RouteOutOfScopeError,
  type TransferConnectionRepository,
} from '@/features/transfer-connection/ports';
import { comboOfConnection, endpointsOfCombo } from '@/features/transfer-connection/domain/normalize';
import { COMBO_KEYS, type ComboKey } from '@/features/transfer-connection/domain/types';
import { isPgErrorCode, pgConstraintName, PG_UNIQUE_VIOLATION } from '@/external/pgError';
import { requireInserted } from '@/external/requireInserted';
import {
  deleteOrphanRoutes,
  pairConnectionCondition,
  routeIdsOfConnections,
  stationPairCondition,
  touchesStationsCondition,
} from '@/external/transferPairSql';

const LABEL_CONSTRAINT = 'unique_connection_route_label';

// 駅対（自駅 S・相手駅 T）の乗換難易度を「最終状態」で1トランザクションに書き込む（ADR-0005）。
// 【紐付け（connection_routes）は全部消してから入れ直す】基準ルートの降格と昇格の順序を誤ると
// unique_connection_baseline に違反するため。connection_routes.id は保存のたびに変わるが、参照する表は無い。
export const dbTransferConnectionRepository: TransferConnectionRepository = {
  async savePair(stationId, connectedStationId, input) {
    try {
      return await withTransaction(async (tx) => {
        // 1. 駅対が存在すること（station_connections は接続一覧）
        const [pair] = await tx
          .select({ id: stationConnections.id })
          .from(stationConnections)
          .where(stationPairCondition(stationId, connectedStationId));
        if (!pair) return false;

        // 2. 既存の接続と、それに結ばれているルート
        const existing = await tx
          .select()
          .from(transferConnections)
          .where(pairConnectionCondition(stationId, connectedStationId));
        const existingByCombo = new Map<ComboKey, string>(
          existing.map((row) => [comboOfConnection(row, stationId), row.id]),
        );
        const existingIds = existing.map((row) => row.id);
        const previousRouteIds = await routeIdsOfConnections(tx, existingIds);

        // 3. 指定された routeId が、この駅対に結ばれているか候補の範囲にあること
        await assertRoutesInScope(tx, stationId, connectedStationId, input, new Set(previousRouteIds));

        // 4. ルート本体と設備
        const routeIds: string[] = [];
        for (const route of input.routes) {
          const values = {
            minutes: route.minutes,
            isOutdoor: route.isOutdoor,
            requiresExitGate: route.requiresExitGate,
            requiresStaff: route.requiresStaff,
            isOfficiallyGuided: route.isOfficiallyGuided,
            notes: route.notes,
          };
          let routeId: string;
          if (route.routeId) {
            await tx.update(transferRoutes).set(values).where(eq(transferRoutes.id, route.routeId));
            routeId = route.routeId;
          } else {
            routeId = requireInserted(
              await tx.insert(transferRoutes).values(values).returning({ id: transferRoutes.id }),
            ).id;
          }
          routeIds.push(routeId);

          await tx.delete(transferRouteFacilities).where(eq(transferRouteFacilities.routeId, routeId));
          if (route.facilities.length > 0) {
            await tx
              .insert(transferRouteFacilities)
              .values(route.facilities.map((typeCode) => ({ routeId, typeCode })));
          }
        }

        // 5. ルートが1本以上ある組み合わせの接続を作る／備考を更新する。
        //    端点は endpointsOfCombo が正規化順（A < B）にする（check が逆順を拒否する）。
        //    既存の接続の source は保つ。新規は 'manual'
        const covered = new Set<ComboKey>(input.routes.flatMap((route) => route.combos));
        const connectionIdByCombo = new Map<ComboKey, string>();
        for (const combo of COMBO_KEYS) {
          if (!covered.has(combo)) continue;
          const notes = input.connectionNotes[combo] ?? null;
          const existingId = existingByCombo.get(combo);
          if (existingId) {
            await tx.update(transferConnections).set({ notes }).where(eq(transferConnections.id, existingId));
            connectionIdByCombo.set(combo, existingId);
          } else {
            const { a, b } = endpointsOfCombo(stationId, connectedStationId, combo);
            const inserted = requireInserted(
              await tx
                .insert(transferConnections)
                .values({
                  stationAId: a.stationId,
                  directionA: a.directionType,
                  stationBId: b.stationId,
                  directionB: b.directionType,
                  notes,
                  source: 'manual',
                })
                .returning({ id: transferConnections.id }),
            );
            connectionIdByCombo.set(combo, inserted.id);
          }
        }

        // 6. 紐付けを全部消してから入れ直す（label・isBaseline は入力どおり）
        if (existingIds.length > 0) {
          await tx.delete(connectionRoutes).where(inArray(connectionRoutes.connectionId, existingIds));
        }
        const links = input.routes.flatMap((route, index) =>
          route.combos.map((combo) => ({
            connectionId: requireCombo(connectionIdByCombo, combo),
            routeId: requireRoute(routeIds, index),
            label: route.label.trim(),
            isBaseline: route.isBaseline,
          })),
        );
        if (links.length > 0) await tx.insert(connectionRoutes).values(links);

        // 7. ルートが0本になった組み合わせの接続を消す（未評価に戻す。紐付けは 6 で消えている）
        const emptyIds = [...existingByCombo]
          .filter(([combo]) => !covered.has(combo))
          .map(([, id]) => id);
        if (emptyIds.length > 0) {
          await tx.delete(transferConnections).where(inArray(transferConnections.id, emptyIds));
        }

        // 8. 紐付けから外れて、どの接続からも参照されなくなったルートを消す
        await deleteOrphanRoutes(tx, previousRouteIds);

        return true;
      });
    } catch (err) {
      // 同じ 23505 でも、label の重複だけを入力者に返せるエラーにする。
      // ほかの制約（基準ルート2本など）は validateSaveInput が先に止めるため、ここへ来たら想定外
      if (isPgErrorCode(err, PG_UNIQUE_VIOLATION) && pgConstraintName(err) === LABEL_CONSTRAINT) {
        throw new RouteLabelTakenError();
      }
      throw err;
    }
  },
};

async function assertRoutesInScope(
  tx: Tx,
  stationId: string,
  connectedStationId: string,
  input: { routes: { routeId: string | null }[] },
  pairRouteIds: Set<string>,
): Promise<void> {
  const outside = [
    ...new Set(
      input.routes
        .map((route) => route.routeId)
        .filter((id): id is string => id !== null && !pairRouteIds.has(id)),
    ),
  ];
  if (outside.length === 0) return;

  const inScope = await tx
    .selectDistinct({ routeId: connectionRoutes.routeId })
    .from(connectionRoutes)
    .innerJoin(transferConnections, eq(transferConnections.id, connectionRoutes.connectionId))
    .where(and(
      inArray(connectionRoutes.routeId, outside),
      touchesStationsCondition([stationId, connectedStationId]),
    ));
  if (inScope.length !== outside.length) throw new RouteOutOfScopeError();
}

// validateSaveInput が「各ルートに組み合わせが1つ以上」を保証しているため、到達しない
function requireCombo(map: Map<ComboKey, string>, combo: ComboKey): string {
  const id = map.get(combo);
  if (!id) throw new Error(`接続が作られていない組み合わせです: ${combo}`);
  return id;
}

function requireRoute(routeIds: string[], index: number): string {
  const id = routeIds[index];
  if (!id) throw new Error(`ルートが作られていません: ${index}`);
  return id;
}
