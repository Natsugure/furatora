import { db } from '@furatora/database/client';
import {
  stations, platforms, trains, trainCarStructures, trainStopPatterns, trainStopPatternCars,
} from '@furatora/database/schema';
import { and, eq, inArray, asc } from 'drizzle-orm';
import type { StopPatternPageQuery } from '@/features/stop-pattern/ports';
import type {
  StopPatternListDTO, StopPatternEditContextDTO, TrainOptionDTO,
} from '@/features/stop-pattern/domain/types';

// ADR-0003 は admin 全体の Query Service 化を後続Issue（#48）としているが、
// この新規ページは ESLint の依存ルールにより src/app/** から @furatora/database を
// 直接 import できないため、この画面2つ分のみ先行導入している。

async function getPlatformWithStation(stationId: string, platformId: string) {
  const [row] = await db
    .select({
      stationName: stations.name,
      platformNumber: platforms.platformNumber,
      physicalLength: platforms.physicalLength,
    })
    .from(platforms)
    .innerJoin(stations, eq(platforms.stationId, stations.id))
    .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)));
  return row ?? null;
}

async function getAllTrainOptions(): Promise<TrainOptionDTO[]> {
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
    })
    .from(trainCarStructures)
    .where(inArray(trainCarStructures.trainId, trainRows.map((t) => t.id)))
    .orderBy(asc(trainCarStructures.carNumber));

  return trainRows.map((t) => {
    const cars = structureRows
      .filter((s) => s.trainId === t.id)
      .map((s) => ({ carNumber: s.carNumber, carLength: s.carLength != null ? Number(s.carLength) : null }));
    // 号車構成が未登録の場合、carCount 件を標準構成として補う
    // （TrainStopPatternForm 側の buildCarSegments は carLength: null を標準値扱いする）
    const resolvedCars = cars.length > 0
      ? cars
      : Array.from({ length: t.carCount }, (_, i) => ({ carNumber: i + 1, carLength: null }));
    return { id: t.id, name: t.name, carCount: t.carCount, cars: resolvedCars };
  });
}

export const dbStopPatternPageQuery: StopPatternPageQuery = {
  async getListByPlatform(stationId, platformId) {
    const platform = await getPlatformWithStation(stationId, platformId);
    if (!platform) return null;

    const patterns = await db
      .select({ id: trainStopPatterns.id, trainId: trainStopPatterns.trainId })
      .from(trainStopPatterns)
      .where(eq(trainStopPatterns.platformId, platformId));

    if (patterns.length === 0) {
      const result: StopPatternListDTO = {
        stationId,
        stationName: platform.stationName,
        platformId,
        platformNumber: platform.platformNumber,
        physicalLength: Number(platform.physicalLength),
        patterns: [],
      };
      return result;
    }

    const [carRows, trainRows] = await Promise.all([
      db
        .select({
          trainStopPatternId: trainStopPatternCars.trainStopPatternId,
          carNumber: trainStopPatternCars.carNumber,
          startMeters: trainStopPatternCars.startMeters,
          endMeters: trainStopPatternCars.endMeters,
        })
        .from(trainStopPatternCars)
        .where(inArray(trainStopPatternCars.trainStopPatternId, patterns.map((p) => p.id)))
        .orderBy(asc(trainStopPatternCars.carNumber)),
      db
        .select({ id: trains.id, name: trains.name })
        .from(trains)
        .where(inArray(trains.id, patterns.map((p) => p.trainId))),
    ]);

    const trainNameById = new Map(trainRows.map((t) => [t.id, t.name]));

    const result: StopPatternListDTO = {
      stationId,
      stationName: platform.stationName,
      platformId,
      platformNumber: platform.platformNumber,
      physicalLength: Number(platform.physicalLength),
      patterns: patterns.map((p) => ({
        id: p.id,
        trainId: p.trainId,
        trainName: trainNameById.get(p.trainId) ?? '(不明な列車)',
        cars: carRows
          .filter((c) => c.trainStopPatternId === p.id)
          .map((c) => ({
            carNumber: c.carNumber,
            startMeters: Number(c.startMeters),
            endMeters: Number(c.endMeters),
          })),
      })),
    };
    return result;
  },

  async getEditContext(stationId, platformId, patternId) {
    const platform = await getPlatformWithStation(stationId, platformId);
    if (!platform) return null;

    const trainOptions = await getAllTrainOptions();

    let pattern: StopPatternEditContextDTO['pattern'];
    if (patternId) {
      const [patternRow] = await db
        .select({ id: trainStopPatterns.id, trainId: trainStopPatterns.trainId })
        .from(trainStopPatterns)
        .where(and(eq(trainStopPatterns.id, patternId), eq(trainStopPatterns.platformId, platformId)));
      if (!patternRow) return null;

      const carRows = await db
        .select({
          carNumber: trainStopPatternCars.carNumber,
          startMeters: trainStopPatternCars.startMeters,
          endMeters: trainStopPatternCars.endMeters,
        })
        .from(trainStopPatternCars)
        .where(eq(trainStopPatternCars.trainStopPatternId, patternId))
        .orderBy(asc(trainStopPatternCars.carNumber));

      pattern = {
        id: patternRow.id,
        trainId: patternRow.trainId,
        cars: carRows.map((c) => ({
          carNumber: c.carNumber,
          startMeters: Number(c.startMeters),
          endMeters: Number(c.endMeters),
        })),
      };
    }

    const result: StopPatternEditContextDTO = {
      stationId,
      stationName: platform.stationName,
      platformId,
      platformNumber: platform.platformNumber,
      physicalLength: Number(platform.physicalLength),
      trains: trainOptions,
      pattern,
    };
    return result;
  },
};
