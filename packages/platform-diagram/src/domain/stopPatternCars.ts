// 停車位置パターンの行から、図に渡す号車（区間・ドア数・設備）を組み立てる純関数（DB非依存）。
// Web（stationDetailQuery）と Admin（stationLayoutPageQuery）の読み取りが同じ組み立て方をするため、ここに置く。
import type { CarNumbersAscendToward } from '@furatora/database/enums';
import { resolvePatternCars, type CarStructureSpec } from './carSegments';
import type { StopPatternCarDTO } from './types';

type DoorEquipment = { nearDoor: number; isStandard: boolean };

export type TrainCarEquipments = { free: DoorEquipment[]; prio: DoorEquipment[] };

export type EquipmentsByTrainCar = {
  get(trainId: string, carNumber: number): TrainCarEquipments | undefined;
};

/**
 * trainEquipments の行を列車・号車ごとにまとめ、フリースペースと優先席に振り分ける。
 * type の語彙は trainEquipments.type（'free_space' | 'priority_seat'）。domain の packages は
 * schema を import できないため文字列で受け、'free_space' 以外を優先席として扱う。
 */
export function groupEquipmentsByTrainCar(
  rows: { trainId: string; carNumber: number; type: string; nearDoor: number; isStandard: boolean }[],
): EquipmentsByTrainCar {
  const byKey = new Map<string, TrainCarEquipments>();
  const keyOf = (trainId: string, carNumber: number) => `${trainId}:${carNumber}`;
  for (const row of rows) {
    const key = keyOf(row.trainId, row.carNumber);
    const entry = byKey.get(key) ?? { free: [], prio: [] };
    const item = { nearDoor: row.nearDoor, isStandard: row.isStandard };
    if (row.type === 'free_space') entry.free.push(item);
    else entry.prio.push(item);
    byKey.set(key, entry);
  }
  return { get: (trainId, carNumber) => byKey.get(keyOf(trainId, carNumber)) };
}

/**
 * 1つの停車位置パターンの号車を組み立てる。区間は保存せず、号車構成と基準点から算出する（ADR-0025）。
 * carOneOuterMeters は decimal 列の値（string）をそのまま受け、ここで number にする。
 */
export function stopPatternCarsOf(
  pattern: { trainId: string; carOneOuterMeters: string; carNumbersAscendToward: CarNumbersAscendToward },
  carCount: number,
  carStructure: CarStructureSpec[],
  equipments: EquipmentsByTrainCar,
): StopPatternCarDTO[] {
  return resolvePatternCars(carStructure, carCount, {
    carOneOuterMeters: Number(pattern.carOneOuterMeters),
    carNumbersAscendToward: pattern.carNumbersAscendToward,
  }).map((car) => {
    const carEquipments = equipments.get(pattern.trainId, car.carNumber);
    return {
      ...car,
      freeSpaceDoors: carEquipments?.free ?? [],
      prioritySeatDoors: carEquipments?.prio ?? [],
    };
  });
}
