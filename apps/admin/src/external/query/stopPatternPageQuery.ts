import { db } from '@furatora/database/client';
import { trains, trainCarStructures } from '@furatora/database/schema';
import { inArray, asc } from 'drizzle-orm';
import { carStructureOrStandard, groupCarStructureByTrain } from '@furatora/platform-diagram/domain';
import type { TrainOptionDTO } from '@/features/stop-pattern/domain/types';

// stationLayoutPageQuery が停車パターン新規作成のプレビュー用の列車一覧
// （号車構成付き）として再利用する Query Service。
export async function getAllTrainOptions(): Promise<TrainOptionDTO[]> {
  const trainRows = await db
    .select({ id: trains.id, name: trains.name, carCount: trains.carCount })
    .from(trains)
    .orderBy(asc(trains.name));

  if (trainRows.length === 0) return [];

  const structureRows = await db
    .select({
      trainId: trainCarStructures.trainId,
      carNumber: trainCarStructures.carNumber,
      carLength: trainCarStructures.carLength,
      doorCount: trainCarStructures.doorCount,
    })
    .from(trainCarStructures)
    .where(inArray(trainCarStructures.trainId, trainRows.map((t) => t.id)))
    .orderBy(asc(trainCarStructures.carNumber));

  const carStructureByTrain = groupCarStructureByTrain(structureRows);
  // 号車構成が未登録の場合、carCount 両の標準構成として補う。読み取り（resolvePatternCars）と同じ補い方
  return trainRows.map((t) => ({
    id: t.id,
    name: t.name,
    carCount: t.carCount,
    cars: carStructureOrStandard(carStructureByTrain.get(t.id) ?? [], t.carCount),
  }));
}
