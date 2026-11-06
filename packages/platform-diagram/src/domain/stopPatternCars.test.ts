import { describe, it, expect } from 'vitest';
import { groupEquipmentsByTrainCar, stopPatternCarsOf } from './stopPatternCars';
import { DEFAULT_DOOR_COUNT } from './carSegments';

describe('groupEquipmentsByTrainCar', () => {
  it('列車・号車ごとに、フリースペースと優先席に振り分ける', () => {
    const grouped = groupEquipmentsByTrainCar([
      { trainId: 't1', carNumber: 1, type: 'free_space', nearDoor: 2, isStandard: true },
      { trainId: 't1', carNumber: 1, type: 'priority_seat', nearDoor: 1, isStandard: false },
      { trainId: 't1', carNumber: 2, type: 'priority_seat', nearDoor: 3, isStandard: true },
      { trainId: 't2', carNumber: 1, type: 'free_space', nearDoor: 4, isStandard: false },
    ]);
    expect(grouped.get('t1', 1)).toEqual({
      free: [{ nearDoor: 2, isStandard: true }],
      prio: [{ nearDoor: 1, isStandard: false }],
    });
    expect(grouped.get('t1', 2)).toEqual({ free: [], prio: [{ nearDoor: 3, isStandard: true }] });
    expect(grouped.get('t2', 1)).toEqual({ free: [{ nearDoor: 4, isStandard: false }], prio: [] });
  });

  it('設備の無い号車は undefined を返す', () => {
    expect(groupEquipmentsByTrainCar([]).get('t1', 1)).toBeUndefined();
  });
});

describe('stopPatternCarsOf', () => {
  it('decimal（string）の基準点を数値にして区間を算出し、各号車に設備を添える', () => {
    const equipments = groupEquipmentsByTrainCar([
      { trainId: 't1', carNumber: 2, type: 'free_space', nearDoor: 1, isStandard: true },
    ]);
    expect(stopPatternCarsOf(
      { trainId: 't1', carOneOuterMeters: '40.00', carNumbersAscendToward: 'minusX' },
      2,
      [{ carNumber: 1, carLength: 25, doorCount: 3 }],
      equipments,
    )).toEqual([
      { carNumber: 1, startMeters: 15, endMeters: 40, doorCount: 3, freeSpaceDoors: [], prioritySeatDoors: [] },
      {
        carNumber: 2, startMeters: -5, endMeters: 15, doorCount: DEFAULT_DOOR_COUNT,
        freeSpaceDoors: [{ nearDoor: 1, isStandard: true }], prioritySeatDoors: [],
      },
    ]);
  });

  it('ほかの列車の設備は添えない', () => {
    const equipments = groupEquipmentsByTrainCar([
      { trainId: 'other', carNumber: 1, type: 'priority_seat', nearDoor: 1, isStandard: true },
    ]);
    const cars = stopPatternCarsOf(
      { trainId: 't1', carOneOuterMeters: '0', carNumbersAscendToward: 'plusX' }, 1, [], equipments,
    );
    expect(cars.map((c) => c.prioritySeatDoors)).toEqual([[]]);
  });
});
