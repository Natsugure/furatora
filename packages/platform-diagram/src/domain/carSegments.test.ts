import { describe, it, expect } from 'vitest';
import {
  carSegmentsFromCarOne, carOneAnchorOf, standardCarStructure, resolvePatternCars, DEFAULT_CAR_LENGTH,
  DEFAULT_DOOR_COUNT, carStructureOrStandard, groupCarStructureByTrain,
} from './carSegments';

const threeStandardCars = [
  { carNumber: 1, carLength: null },
  { carNumber: 2, carLength: null },
  { carNumber: 3, carLength: null },
];

describe('carSegmentsFromCarOne', () => {
  it('plusX: 1号車の外側の端から x の増える側へ積む', () => {
    expect(carSegmentsFromCarOne(threeStandardCars, 10, 'plusX')).toEqual([
      { carNumber: 1, startMeters: 10, endMeters: 30 },
      { carNumber: 2, startMeters: 30, endMeters: 50 },
      { carNumber: 3, startMeters: 50, endMeters: 70 },
    ]);
  });

  it('minusX: 1号車の外側の端から x の減る側へ積み、どの号車も start < end を保つ', () => {
    expect(carSegmentsFromCarOne(threeStandardCars, 100, 'minusX')).toEqual([
      { carNumber: 1, startMeters: 80, endMeters: 100 },
      { carNumber: 2, startMeters: 60, endMeters: 80 },
      { carNumber: 3, startMeters: 40, endMeters: 60 },
    ]);
  });

  it('carLength の指定あり・未指定が混在する編成を扱える', () => {
    expect(carSegmentsFromCarOne(
      [{ carNumber: 1, carLength: 25 }, { carNumber: 2, carLength: null }],
      0,
      'plusX',
    )).toEqual([
      { carNumber: 1, startMeters: 0, endMeters: 25 },
      { carNumber: 2, startMeters: 25, endMeters: 25 + DEFAULT_CAR_LENGTH },
    ]);
  });

  it('入力の並びによらず carNumber 昇順で返す', () => {
    const result = carSegmentsFromCarOne(
      [{ carNumber: 2, carLength: null }, { carNumber: 1, carLength: null }],
      0,
      'plusX',
    );
    expect(result.map((c) => c.carNumber)).toEqual([1, 2]);
    expect(result[0]).toEqual({ carNumber: 1, startMeters: 0, endMeters: 20 });
  });

  it('端数の長さを積んでも小数2桁に丸め、隣接号車の境界が一致する', () => {
    const cars = Array.from({ length: 10 }, (_, i) => ({ carNumber: i + 1, carLength: 18.3 }));
    const result = carSegmentsFromCarOne(cars, 0.1, 'plusX');
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]!.endMeters).toBe(result[i + 1]!.startMeters);
    }
    expect(result[9]!.endMeters).toBe(183.1);
  });

  it('号車構成が空なら空配列を返す', () => {
    expect(carSegmentsFromCarOne([], 0, 'plusX')).toEqual([]);
  });

  it('両数を減らしても1号車の位置は変わらず、消えた号車は返さない（#215）', () => {
    const ten = standardCarStructure(10);
    const eight = standardCarStructure(8);
    const before = carSegmentsFromCarOne(ten, 200, 'minusX');
    const after = carSegmentsFromCarOne(eight, 200, 'minusX');
    expect(after[0]).toEqual(before[0]);
    expect(after.map((c) => c.carNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('standardCarStructure', () => {
  it('carCount 両の標準構成（carLength: null・既定のドア数）を返す', () => {
    expect(standardCarStructure(2)).toEqual([
      { carNumber: 1, carLength: null, doorCount: DEFAULT_DOOR_COUNT },
      { carNumber: 2, carLength: null, doorCount: DEFAULT_DOOR_COUNT },
    ]);
  });
});

describe('carStructureOrStandard', () => {
  it('号車構成が1..carCount そろっていれば、その値を carNumber 昇順で返す', () => {
    const structure = [
      { carNumber: 2, carLength: 18, doorCount: 4 },
      { carNumber: 1, carLength: 25, doorCount: 3 },
    ];
    expect(carStructureOrStandard(structure, 2)).toEqual([
      { carNumber: 1, carLength: 25, doorCount: 3 },
      { carNumber: 2, carLength: 18, doorCount: 4 },
    ]);
  });

  it('号車構成が無ければ標準構成を返す', () => {
    expect(carStructureOrStandard([], 2)).toEqual(standardCarStructure(2));
  });

  it('抜けた号車は標準の長さ・ドア数で補う（1号車が無い構成でも1号車を返す）', () => {
    const structure = [{ carNumber: 3, carLength: 25, doorCount: 3 }];
    expect(carStructureOrStandard(structure, 3)).toEqual([
      { carNumber: 1, carLength: null, doorCount: DEFAULT_DOOR_COUNT },
      { carNumber: 2, carLength: null, doorCount: DEFAULT_DOOR_COUNT },
      { carNumber: 3, carLength: 25, doorCount: 3 },
    ]);
  });

  it('carCount を超える号車は含めない', () => {
    const structure = [
      { carNumber: 1, carLength: 25, doorCount: 3 },
      { carNumber: 2, carLength: 25, doorCount: 3 },
    ];
    expect(carStructureOrStandard(structure, 1)).toEqual([{ carNumber: 1, carLength: 25, doorCount: 3 }]);
  });
});

describe('groupCarStructureByTrain', () => {
  it('列車ごとにまとめ、decimal の carLength を number にする', () => {
    const byTrain = groupCarStructureByTrain([
      { trainId: 't1', carNumber: 1, doorCount: 4, carLength: '20.50' },
      { trainId: 't2', carNumber: 1, doorCount: 3, carLength: null },
      { trainId: 't1', carNumber: 2, doorCount: 4, carLength: null },
    ]);
    expect(byTrain.get('t1')).toEqual([
      { carNumber: 1, doorCount: 4, carLength: 20.5 },
      { carNumber: 2, doorCount: 4, carLength: null },
    ]);
    expect(byTrain.get('t2')).toEqual([{ carNumber: 1, doorCount: 3, carLength: null }]);
  });
});

describe('carOneAnchorOf', () => {
  it('plusX では1号車の startMeters、minusX では endMeters を返す', () => {
    const cars = [{ carNumber: 1, startMeters: 80, endMeters: 100 }, { carNumber: 2, startMeters: 60, endMeters: 80 }];
    expect(carOneAnchorOf(cars, 'minusX')).toBe(100);
    expect(carOneAnchorOf(cars, 'plusX')).toBe(80);
  });

  it('carSegmentsFromCarOne の結果から基準点を戻せる', () => {
    for (const dir of ['plusX', 'minusX'] as const) {
      expect(carOneAnchorOf(carSegmentsFromCarOne(threeStandardCars, 42.5, dir), dir)).toBe(42.5);
    }
  });

  it('1号車が無ければ null を返す', () => {
    expect(carOneAnchorOf([{ carNumber: 2, startMeters: 0, endMeters: 20 }], 'plusX')).toBeNull();
  });
});

describe('resolvePatternCars', () => {
  it('号車構成から区間を算出し、各号車のドア数を添える', () => {
    expect(resolvePatternCars(
      [{ carNumber: 2, carLength: null, doorCount: 3 }, { carNumber: 1, carLength: 25, doorCount: 4 }],
      2,
      { carOneOuterMeters: 0, carNumbersAscendToward: 'plusX' },
    )).toEqual([
      { carNumber: 1, startMeters: 0, endMeters: 25, doorCount: 4 },
      { carNumber: 2, startMeters: 25, endMeters: 45, doorCount: 3 },
    ]);
  });

  it('号車構成が無ければ carCount 両の標準構成（20m・既定のドア数）で算出する', () => {
    expect(resolvePatternCars([], 2, { carOneOuterMeters: 40, carNumbersAscendToward: 'minusX' })).toEqual([
      { carNumber: 1, startMeters: 20, endMeters: 40, doorCount: DEFAULT_DOOR_COUNT },
      { carNumber: 2, startMeters: 0, endMeters: 20, doorCount: DEFAULT_DOOR_COUNT },
    ]);
  });

  it('基準点と向きは必須で、null を受けない（2列は NOT NULL。#224）', () => {
    // 型だけを確かめる（呼び出さない）
    const typeOnly = () => {
      // @ts-expect-error 基準点は null にならない
      resolvePatternCars([], 2, { carOneOuterMeters: null, carNumbersAscendToward: 'plusX' });
      // @ts-expect-error 向きは null にならない
      resolvePatternCars([], 2, { carOneOuterMeters: 0, carNumbersAscendToward: null });
    };
    expect(typeOnly).toBeTypeOf('function');
  });
});
