import { describe, it, expect } from 'vitest';
import { equipmentDoorIssues } from './equipmentDoors';

const CARS = [
  { carNumber: 1, doorCount: 4 },
  { carNumber: 2, doorCount: 3 },
];

describe('equipmentDoorIssues', () => {
  it('号車のドア数の範囲内（1・上限）なら issue は無い', () => {
    expect(equipmentDoorIssues(CARS, [
      { carNumber: 1, nearDoor: 1 },
      { carNumber: 1, nearDoor: 4 },
      { carNumber: 2, nearDoor: 3 },
    ])).toEqual([]);
  });

  it('ドア番号が上限を超えると、その行の nearDoor を指す', () => {
    expect(equipmentDoorIssues(CARS, [
      { carNumber: 1, nearDoor: 1 },
      { carNumber: 2, nearDoor: 4 },
    ])).toEqual([{ index: 1, field: 'nearDoor', message: '2号車のドアは1〜3番です' }]);
  });

  it('ドア番号が 0 なら、その行の nearDoor を指す', () => {
    expect(equipmentDoorIssues(CARS, [{ carNumber: 1, nearDoor: 0 }]))
      .toEqual([{ index: 0, field: 'nearDoor', message: '1号車のドアは1〜4番です' }]);
  });

  it('車両構成に無い号車は、ドア番号を確かめず carNumber を指す', () => {
    expect(equipmentDoorIssues(CARS, [{ carNumber: 3, nearDoor: 99 }]))
      .toEqual([{ index: 0, field: 'carNumber', message: '3号車は車両構成にありません' }]);
  });

  it('車両構成が null なら、どの号車も無い扱いにする', () => {
    expect(equipmentDoorIssues(null, [{ carNumber: 1, nearDoor: 1 }]))
      .toEqual([{ index: 0, field: 'carNumber', message: '1号車は車両構成にありません' }]);
  });

  it('同じ号車・ドア番号の行が 2 回あれば、2 回目の行の nearDoor を指す', () => {
    // DB の一意制約 unique_train_equipment に当たる前に、行ごとのエラーで止める
    expect(equipmentDoorIssues(CARS, [
      { carNumber: 1, nearDoor: 2 },
      { carNumber: 2, nearDoor: 2 },
      { carNumber: 1, nearDoor: 2 },
    ])).toEqual([{ index: 2, field: 'nearDoor', message: '1号車のドア2番が重複しています' }]);
  });

  it('範囲外の行は重複の判定に入れず、範囲外の issue だけを出す', () => {
    expect(equipmentDoorIssues(CARS, [
      { carNumber: 2, nearDoor: 9 },
      { carNumber: 2, nearDoor: 9 },
    ])).toEqual([
      { index: 0, field: 'nearDoor', message: '2号車のドアは1〜3番です' },
      { index: 1, field: 'nearDoor', message: '2号車のドアは1〜3番です' },
    ]);
  });

  it('設備が無ければ issue は無い', () => {
    expect(equipmentDoorIssues(undefined, [])).toEqual([]);
  });
});
