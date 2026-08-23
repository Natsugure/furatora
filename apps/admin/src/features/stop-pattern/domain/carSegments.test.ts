import { describe, it, expect } from 'vitest';
import { buildCarSegments, DEFAULT_CAR_LENGTH } from './carSegments';

describe('buildCarSegments', () => {
  it('carLength未指定の場合は標準値（20.0m）で積算される（carOneNearest）', () => {
    const result = buildCarSegments(
      [
        { carNumber: 1, carLength: null },
        { carNumber: 2, carLength: null },
        { carNumber: 3, carLength: null },
      ],
      0,
      'carOneNearest',
    );
    expect(result).toEqual([
      { carNumber: 1, startMeters: 0, endMeters: 20 },
      { carNumber: 2, startMeters: 20, endMeters: 40 },
      { carNumber: 3, startMeters: 40, endMeters: 60 },
    ]);
  });

  it('carLength指定時はその値で積算される', () => {
    const result = buildCarSegments(
      [
        { carNumber: 1, carLength: 25.5 },
        { carNumber: 2, carLength: 18.0 },
      ],
      10,
      'carOneNearest',
    );
    expect(result).toEqual([
      { carNumber: 1, startMeters: 10, endMeters: 35.5 },
      { carNumber: 2, startMeters: 35.5, endMeters: 53.5 },
    ]);
  });

  it('carLengthの指定あり／未指定が混在する編成を扱える', () => {
    const result = buildCarSegments(
      [
        { carNumber: 1, carLength: 25.0 },
        { carNumber: 2, carLength: null },
      ],
      0,
      'carOneNearest',
    );
    expect(result).toEqual([
      { carNumber: 1, startMeters: 0, endMeters: 25 },
      { carNumber: 2, startMeters: 25, endMeters: 25 + DEFAULT_CAR_LENGTH },
    ]);
  });

  it('lastCarNearestでは積算順が逆転するが、各号車の区間の向きは反転しない', () => {
    const result = buildCarSegments(
      [
        { carNumber: 1, carLength: 20 },
        { carNumber: 2, carLength: 20 },
        { carNumber: 3, carLength: 20 },
      ],
      0,
      'lastCarNearest',
    );
    // x=0 に近い側から 3号車→2号車→1号車の順に積算される
    expect(result).toEqual([
      { carNumber: 1, startMeters: 40, endMeters: 60 },
      { carNumber: 2, startMeters: 20, endMeters: 40 },
      { carNumber: 3, startMeters: 0, endMeters: 20 },
    ]);
    for (const seg of result) {
      expect(seg.startMeters).toBeLessThan(seg.endMeters);
    }
  });

  it('order によらず全号車で startMeters < endMeters を保つ', () => {
    const carStructure = [
      { carNumber: 1, carLength: 19.5 },
      { carNumber: 2, carLength: null },
      { carNumber: 3, carLength: 21.2 },
    ];
    for (const order of ['carOneNearest', 'lastCarNearest'] as const) {
      const result = buildCarSegments(carStructure, -3, order);
      for (const seg of result) {
        expect(seg.startMeters).toBeLessThan(seg.endMeters);
      }
    }
  });

  it('戻り値はcarNumber昇順である', () => {
    const result = buildCarSegments(
      [
        { carNumber: 3, carLength: 20 },
        { carNumber: 1, carLength: 20 },
        { carNumber: 2, carLength: 20 },
      ],
      0,
      'carOneNearest',
    );
    expect(result.map((s) => s.carNumber)).toEqual([1, 2, 3]);
  });

  it('負のstartMetersを入力できる（頭端式ホームの外側等）', () => {
    const result = buildCarSegments(
      [{ carNumber: 1, carLength: 20 }],
      -10,
      'carOneNearest',
    );
    expect(result).toEqual([{ carNumber: 1, startMeters: -10, endMeters: 10 }]);
  });
});
