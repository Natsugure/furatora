import { db } from '@furatora/database/client';
import { operators, lines, trains, trainEquipments, trainCarStructures } from '@furatora/database/schema';
import { asc, eq } from 'drizzle-orm';
import type {
  TrainEditPageQuery, TrainDTO, OperatorOption, TrainLineOption,
} from '@/features/train/ports';

// src/app/** は ESLint の依存ルールで @furatora/database を直接 import できないため、
// 列車の新規・編集ページと複製（GET /api/trains/[trainId]）はここを通して読む。

async function getOperatorOptions(): Promise<OperatorOption[]> {
  return db
    .select({ id: operators.id, name: operators.name })
    .from(operators)
    .orderBy(asc(operators.name));
}

async function getLineOptions(): Promise<TrainLineOption[]> {
  const rows = await db
    .select({
      id: lines.id,
      name: lines.name,
      nameEn: lines.nameEn,
      operatorId: lines.operatorId,
    })
    .from(lines)
    .orderBy(asc(lines.displayOrder));
  return rows.map((r) => ({ ...r, nameEn: r.nameEn ?? '' }));
}

async function getTrain(trainId: string): Promise<TrainDTO | null> {
  const [train] = await db.select().from(trains).where(eq(trains.id, trainId));
  if (!train) return null;

  const [equipments, carStructureRows] = await Promise.all([
    db.select().from(trainEquipments).where(eq(trainEquipments.trainId, trainId)),
    db.select().from(trainCarStructures).where(eq(trainCarStructures.trainId, trainId)),
  ]);

  return {
    id: train.id,
    name: train.name,
    // trains テーブルの列名は operators（単一FK）/ lines（uuid配列）
    operatorId: train.operators,
    lineIds: train.lines,
    carCount: train.carCount,
    carStructure: carStructureRows.length > 0
      ? carStructureRows.map((cs) => ({
          carNumber: cs.carNumber,
          doorCount: cs.doorCount,
          // decimal は文字列で返るため、trainSchema（数値）に合わせて変換する
          carLength: cs.carLength != null ? Number(cs.carLength) : null,
        }))
      : null,
    freeSpaces: equipments
      .filter((e) => e.type === 'free_space')
      .map((e) => ({ carNumber: e.carNumber, nearDoor: e.nearDoor, isStandard: e.isStandard })),
    prioritySeats: equipments
      .filter((e) => e.type === 'priority_seat')
      .map((e) => ({ carNumber: e.carNumber, nearDoor: e.nearDoor, isStandard: e.isStandard })),
  };
}

export const dbTrainEditPageQuery: TrainEditPageQuery = {
  async getCreateContext() {
    const [operatorOptions, lineOptions] = await Promise.all([
      getOperatorOptions(),
      getLineOptions(),
    ]);
    return { operators: operatorOptions, lines: lineOptions };
  },

  async getEditContext(trainId) {
    const [train, operatorOptions, lineOptions] = await Promise.all([
      getTrain(trainId),
      getOperatorOptions(),
      getLineOptions(),
    ]);
    if (!train) return null;
    return { operators: operatorOptions, lines: lineOptions, train };
  },

  getTrain,
};
