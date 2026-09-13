import { db } from '@furatora/database/client';
import { withTransaction, type Tx } from '@furatora/database/tx';
import {
  platformLocations,
  platformLocationCells,
  stationFacilities,
  facilityConnections,
} from '@furatora/database/schema';
import { and, eq, inArray } from 'drizzle-orm';
import type { PlatformLocationInput } from '@/features/facility/schema';
import type { PlatformLocationRepository, PlatformLocationRecord } from '@/features/facility/ports';
import { requireInserted } from '@/external/requireInserted';
import { isPlatformOfStation, belongsToStation } from '@/external/repository/stationScopeGuard';

// platformLocations → platformLocationCells → stationFacilities / facilityConnections
// の複数テーブルにまたがる書き込みのため withTransaction で原子化する（ADR-0005）。

async function insertCellsAndFacilities(
  tx: Tx,
  platformLocationId: string,
  cells: PlatformLocationInput['cells']
) {
  for (const cell of cells) {
    const insertedCell = requireInserted(
      await tx
        .insert(platformLocationCells)
        .values({
          platformLocationId,
          xPositionMeters: cell.xPositionMeters != null ? String(cell.xPositionMeters) : null,
        })
        .returning()
    );

    if (cell.facilities.length > 0) {
      await tx.insert(stationFacilities).values(
        cell.facilities.map((f) => ({
          platformLocationCellId: insertedCell.id,
          typeCode: f.typeCode,
          // undefined（フィールド省略）のみ既定値 true を補う。明示的な null は
          // そのまま保存する（?? だと null も true に書き換わってしまう。
          // Issue #95 の図上編集は全置換PUTのため、座標だけ動かす保存でも
          // 未設定(null)のアクセシビリティ属性を保つ必要がある）
          isWheelchairAccessible: f.isWheelchairAccessible === undefined ? true : f.isWheelchairAccessible,
          isStrollerAccessible: f.isStrollerAccessible === undefined ? true : f.isStrollerAccessible,
          notes: f.notes ?? null,
        }))
      );
    }
  }
}

async function insertConnections(
  tx: Tx,
  platformLocationId: string,
  connections: PlatformLocationInput['connections']
) {
  if (!connections || connections.length === 0) return;
  await tx.insert(facilityConnections).values(
    connections.map((c) => ({
      platformLocationId,
      connectedStationId: c.stationId,
      connectedPlatformId: c.connectedPlatformId ?? null,
      directionId: c.directionId ?? null,
      exitLabel: c.exitLabel ?? null,
      xRangeStart: c.xRangeStart != null ? String(c.xRangeStart) : null,
      xRangeEnd: c.xRangeEnd != null ? String(c.xRangeEnd) : null,
    }))
  );
}

export const dbPlatformLocationRepository: PlatformLocationRepository = {
  async create(stationId, input) {
    return withTransaction(async (tx) => {
      if (!(await isPlatformOfStation(tx, input.platformId, stationId))) return null;

      const location = requireInserted(
        await tx
          .insert(platformLocations)
          .values({
            platformId: input.platformId,
            exits: input.exits ?? null,
            notes: input.notes ?? null,
          })
          .returning()
      );

      await insertCellsAndFacilities(tx, location.id, input.cells);
      await insertConnections(tx, location.id, input.connections);

      return location as PlatformLocationRecord;
    });
  },

  async update(id, stationId, input) {
    return withTransaction(async (tx) => {
      // 付け替え先ホームが他駅のものであれば、更新対象が当該駅のものでも拒否する
      if (!(await isPlatformOfStation(tx, input.platformId, stationId))) return null;

      const [updated] = await tx
        .update(platformLocations)
        .set({
          platformId: input.platformId,
          exits: input.exits ?? null,
          notes: input.notes ?? null,
        })
        .where(and(eq(platformLocations.id, id), belongsToStation(platformLocations.platformId, stationId)))
        .returning();

      if (!updated) return null;

      // アクセス点を再登録（既存削除→再挿入。stationFacilities は CASCADE で削除）
      const existingCells = await tx
        .select({ id: platformLocationCells.id })
        .from(platformLocationCells)
        .where(eq(platformLocationCells.platformLocationId, id));

      if (existingCells.length > 0) {
        await tx.delete(stationFacilities).where(
          inArray(stationFacilities.platformLocationCellId, existingCells.map((c) => c.id))
        );
      }
      await tx.delete(platformLocationCells).where(eq(platformLocationCells.platformLocationId, id));
      await insertCellsAndFacilities(tx, id, input.cells);

      // 乗換駅接続を再登録（既存削除→再挿入）
      await tx.delete(facilityConnections).where(eq(facilityConnections.platformLocationId, id));
      await insertConnections(tx, id, input.connections);

      return updated as PlatformLocationRecord;
    });
  },

  async delete(id, stationId) {
    // 子テーブルは CASCADE で削除されるため、単一の DELETE 文で原子的に完結する
    const [row] = await db
      .delete(platformLocations)
      .where(and(eq(platformLocations.id, id), belongsToStation(platformLocations.platformId, stationId)))
      .returning();
    return !!row;
  },
};
