import { describe, it, expect } from 'vitest';
import { computeBounds, MARGIN_METERS } from './geometry';
import type { TrainStopPatternDTO, ConcourseDTO } from './types';

function pattern(cars: { carNumber: number; startMeters: number; endMeters: number }[]): Pick<TrainStopPatternDTO, 'cars'> {
  return {
    cars: cars.map((c) => ({
      ...c,
      doorCount: 4,
      freeSpaceDoors: [],
      prioritySeatDoors: [],
    })),
  };
}

function concourse(
  cells: { xPositionMeters: number | null }[],
  connections: { xRangeStart: number | null; xRangeEnd: number | null }[] = [],
): Pick<ConcourseDTO, 'cells' | 'connections'> {
  return {
    cells: cells.map((c) => ({ ...c, facilities: [] })),
    connections: connections.map((c) => ({
      ...c,
      stationName: '',
      lineNames: [],
      lineColors: [],
      directionName: null,
      exitLabel: null,
    })),
  };
}

describe('computeBounds', () => {
  it('[0, physicalLength] を常に描画範囲に含める（設備・停車位置パターンが0件でも）', () => {
    const bounds = computeBounds(210, [], []);
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 210 + MARGIN_METERS });
  });

  it('停車位置パターンが0件でもホームだけが描画される', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: 50 }])]);
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('車両の停車範囲外（physicalLength超過）の設備を範囲に含める', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: 150 }])]);
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 150 + MARGIN_METERS });
  });

  it('負座標の設備を範囲に含める', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: -20 }])]);
    expect(bounds).toEqual({ minX: -20 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('xPositionMeters が null（コンコース全体）の設備は範囲計算の対象にしない', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: null }])]);
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('physicalLength を超える停車位置パターンを範囲に含める', () => {
    const bounds = computeBounds(
      100,
      [pattern([{ carNumber: 1, startMeters: 90, endMeters: 130 }])],
      [],
    );
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 130 + MARGIN_METERS });
  });

  it('負のstartMetersを持つ停車位置パターンを範囲に含める（頭端式ホーム等）', () => {
    const bounds = computeBounds(
      100,
      [pattern([{ carNumber: 1, startMeters: -15, endMeters: 5 }])],
      [],
    );
    expect(bounds).toEqual({ minX: -15 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('対面乗換帯（xRangeStart/xRangeEnd）を範囲に含める', () => {
    const bounds = computeBounds(
      100,
      [],
      [concourse([], [{ xRangeStart: -10, xRangeEnd: 20 }])],
    );
    expect(bounds).toEqual({ minX: -10 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('xRangeStart/xRangeEnd が片方でもnullの対面乗換帯は範囲計算の対象にしない', () => {
    const bounds = computeBounds(
      100,
      [],
      [concourse([], [{ xRangeStart: 500, xRangeEnd: null }])],
    );
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('複数の設備・パターンから最小・最大を正しく求める', () => {
    const bounds = computeBounds(
      100,
      [
        pattern([
          { carNumber: 1, startMeters: -5, endMeters: 15 },
          { carNumber: 2, startMeters: 15, endMeters: 35 },
        ]),
      ],
      [concourse([{ xPositionMeters: 120 }, { xPositionMeters: 3 }])],
    );
    expect(bounds).toEqual({ minX: -5 - MARGIN_METERS, maxX: 120 + MARGIN_METERS });
  });
});
