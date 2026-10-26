import { db } from '@furatora/database/client';
import { withTransaction, type Tx } from '@furatora/database/tx';
import { trains, trainCarStructures, trainEquipments } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import type { TrainRepository } from '@/features/train/ports';
import type { TrainInput } from '@/features/train/schema';
import { requireInserted } from '@/external/requireInserted';

// trains テーブルの列名は operators（単一FK）/ lines（uuid配列）
function trainValues(input: TrainInput) {
  return {
    name: input.name,
    operators: input.operatorId,
    lines: input.lineIds,
    carCount: input.carCount,
  };
}

// 号車構成・設備は create と update で同じ形で入れる。
// 空の values([]) は Drizzle が例外を投げるため、行が無ければ insert しない
async function insertChildren(tx: Tx, trainId: string, input: TrainInput) {
  const carRows = (input.carStructure ?? []).map((cs) => ({
    trainId,
    carNumber: cs.carNumber,
    doorCount: cs.doorCount,
    // decimal 列は文字列で書く（#165 で mode: 'number' にするまで）
    carLength: cs.carLength != null ? String(cs.carLength) : null,
  }));
  if (carRows.length > 0) {
    await tx.insert(trainCarStructures).values(carRows);
  }

  const toEquipmentRow = (type: 'free_space' | 'priority_seat') =>
    (e: { carNumber: number; nearDoor: number; isStandard: boolean }) => ({
      trainId,
      type,
      carNumber: e.carNumber,
      nearDoor: e.nearDoor,
      isStandard: e.isStandard,
    });
  const equipmentRows = [
    ...(input.freeSpaces ?? []).map(toEquipmentRow('free_space')),
    ...(input.prioritySeats ?? []).map(toEquipmentRow('priority_seat')),
  ];
  if (equipmentRows.length > 0) {
    await tx.insert(trainEquipments).values(equipmentRows);
  }
}

// 列車・号車構成・設備の3テーブルにまたがり、途中で失敗すると号車構成や設備の欠けた列車が残るため、
// create / update は withTransaction で囲む（ADR-0005）
export const dbTrainRepository: TrainRepository = {
  async create(input) {
    return withTransaction(async (tx) => {
      const row = requireInserted(
        await tx.insert(trains).values(trainValues(input)).returning({ id: trains.id })
      );
      await insertChildren(tx, row.id, input);
      return { id: row.id };
    });
  },

  async update(id, input) {
    return withTransaction(async (tx) => {
      const [updated] = await tx
        .update(trains)
        .set(trainValues(input))
        .where(eq(trains.id, id))
        .returning({ id: trains.id });
      if (!updated) return false;

      // 号車構成・設備は消して入れ直す
      await tx.delete(trainCarStructures).where(eq(trainCarStructures.trainId, id));
      await tx.delete(trainEquipments).where(eq(trainEquipments.trainId, id));
      await insertChildren(tx, id, input);
      return true;
    });
  },

  async delete(id) {
    // 号車構成・設備・停車位置パターンは CASCADE で削除される。1文のため withTransaction は使わない
    const [row] = await db.delete(trains).where(eq(trains.id, id)).returning({ id: trains.id });
    return !!row;
  },
};
