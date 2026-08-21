import { describe, it, expect } from 'vitest';
import {
  computeBounds,
  layoutRows,
  FACILITY_ROW_HEIGHT,
  GAP_Y,
  MARGIN_METERS,
  PLATFORM_BAR_HEIGHT,
  PLATFORM_LABEL_FONT_SIZE,
  TRAIN_ROW_HEIGHT,
  CONCOURSE_TICK_HEIGHT,
  CONCOURSE_SLOT_HEIGHT,
} from './geometry';
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

describe('layoutRows', () => {
  const sides = [
    { name: "platformSide='top'", side: 'top' as const },
    { name: "platformSide='bottom'", side: 'bottom' as const },
    { name: 'platformSide未設定(null)', side: null },
  ];

  // ラベルの text.y はベースライン。実際の文字の張り出しはフォント依存なので、
  // 一般的な欧文フォントの ascent/descent を上回る値で概算し、安全側に倒す。
  const labelExtent = (platformLabelY: number) => ({
    top: platformLabelY - PLATFORM_LABEL_FONT_SIZE,
    bottom: platformLabelY + PLATFORM_LABEL_FONT_SIZE * 0.3,
  });

  describe.each(sides)('$name', ({ side }) => {
    it('すべての描画要素が viewBox の高さに収まる', () => {
      const { facilityY, trainY, bandY, platformBarY, platformLabelY, viewHeight } = layoutRows(side);
      const label = labelExtent(platformLabelY);

      const spans: [string, number, number][] = [
        ['設備行', facilityY, facilityY + FACILITY_ROW_HEIGHT],
        ['列車行', trainY, trainY + TRAIN_ROW_HEIGHT],
        ['対面乗換帯', bandY, bandY + GAP_Y],
        ['ホーム帯', platformBarY, platformBarY + PLATFORM_BAR_HEIGHT],
        ['両端ラベル', label.top, label.bottom],
      ];

      const outOfView = spans.filter(([, top, bottom]) => top < 0 || bottom > viewHeight).map(([name]) => name);
      expect(outOfView).toEqual([]);
    });

    it('設備行と列車行が重ならない', () => {
      const { facilityY, trainY } = layoutRows(side);
      const facilityIsAbove = facilityY < trainY;
      expect(
        facilityIsAbove
          ? facilityY + FACILITY_ROW_HEIGHT <= trainY
          : trainY + TRAIN_ROW_HEIGHT <= facilityY,
      ).toBe(true);
    });

    it('対面乗換帯が設備行と列車行の隙間にちょうど収まる', () => {
      const { facilityY, trainY, bandY } = layoutRows(side);
      const gapTop = facilityY < trainY ? facilityY + FACILITY_ROW_HEIGHT : trainY + TRAIN_ROW_HEIGHT;

      expect(bandY).toBeCloseTo(gapTop);
      expect(bandY + GAP_Y).toBeCloseTo(facilityY < trainY ? trainY : facilityY);
    });

    it('ホーム帯と両端ラベルが列車行から見て設備行と同じ側にある', () => {
      const { facilityY, trainY, platformBarY, platformLabelY } = layoutRows(side);
      const label = labelExtent(platformLabelY);

      if (facilityY < trainY) {
        // ホームが上側: ホーム帯・ラベルは列車の上端より上
        expect(platformBarY + PLATFORM_BAR_HEIGHT).toBeLessThanOrEqual(trainY);
        expect(label.bottom).toBeLessThanOrEqual(trainY);
      } else {
        // ホームが下側: ホーム帯・ラベルは列車の下端より下
        expect(platformBarY).toBeGreaterThanOrEqual(trainY + TRAIN_ROW_HEIGHT);
        expect(label.top).toBeGreaterThanOrEqual(trainY + TRAIN_ROW_HEIGHT);
      }
    });

    // 文字の張り出しぶんまではフォント依存で厳密に保証できないため、
    // ベースラインがホーム帯の外側にあること（= 文字が帯の上に乗らないこと）を見る。
    it('両端ラベルのベースラインがホーム帯の外側にある', () => {
      const { trainY, facilityY, platformBarY, platformLabelY } = layoutRows(side);

      if (facilityY < trainY) {
        expect(platformLabelY).toBeLessThanOrEqual(platformBarY);
      } else {
        expect(platformLabelY).toBeGreaterThanOrEqual(platformBarY + PLATFORM_BAR_HEIGHT);
      }
    });
  });

  it("platformSide='top' では設備行が列車行より上に来る", () => {
    const { facilityY, trainY } = layoutRows('top');
    expect(facilityY).toBeLessThan(trainY);
  });

  it("platformSide='bottom' では設備行が列車行より下に来る", () => {
    const { facilityY, trainY } = layoutRows('bottom');
    expect(facilityY).toBeGreaterThan(trainY);
  });

  it("platformSide未設定(null)は 'bottom' と同じレイアウトになる", () => {
    expect(layoutRows(null)).toEqual(layoutRows('bottom'));
  });

  it("platformSide の 'top' / 'bottom' で上下が反転する", () => {
    const top = layoutRows('top');
    const bottom = layoutRows('bottom');

    // viewBox の中心線に対して線対称になっている
    const mirror = (y: number, height: number) => top.viewHeight - (y + height);
    expect(mirror(top.facilityY, FACILITY_ROW_HEIGHT)).toBeCloseTo(bottom.facilityY);
    expect(mirror(top.trainY, TRAIN_ROW_HEIGHT)).toBeCloseTo(bottom.trainY);
    expect(mirror(top.bandY, GAP_Y)).toBeCloseTo(bottom.bandY);
    expect(mirror(top.platformBarY, PLATFORM_BAR_HEIGHT)).toBeCloseTo(bottom.platformBarY);
  });
  describe('コンコースラベル段', () => {
    it('段数0ではラベル領域の高さが加算されず、束ね線も段も無い', () => {
      const layout = layoutRows('top', 0);

      expect(layout.concourseBracketY).toBeNull();
      expect(layout.concourseTickStartY).toBeNull();
      expect(layout.concourseSlotTops).toEqual([]);
      // ラベル導入前の高さ（マージン2 + 設備8 + 隙間2 + 列車10）と一致する
      expect(layout.viewHeight).toBe(2 + FACILITY_ROW_HEIGHT + GAP_Y + TRAIN_ROW_HEIGHT);
    });

    it('引数を省略した場合は段数0として扱う', () => {
      expect(layoutRows('top')).toEqual(layoutRows('top', 0));
    });

    it.each([1, 2, 3])('段数%iぶんだけ viewHeight が伸びる', (rows) => {
      const base = layoutRows('top', 0).viewHeight;
      expect(layoutRows('top', rows).viewHeight).toBe(
        base + CONCOURSE_TICK_HEIGHT + rows * CONCOURSE_SLOT_HEIGHT,
      );
    });

    describe.each(sides)('$name', ({ side }) => {
      it('束ね線とラベル段が列車行から見て設備行と同じ側にある', () => {
        const { facilityY, trainY, concourseBracketY, concourseSlotTops } = layoutRows(side, 2);
        const facilityIsAbove = facilityY < trainY;

        expect(concourseBracketY).not.toBeNull();
        for (const y of [concourseBracketY!, ...concourseSlotTops]) {
          if (facilityIsAbove) {
            expect(y).toBeLessThanOrEqual(facilityY);
          } else {
            expect(y).toBeGreaterThanOrEqual(facilityY + FACILITY_ROW_HEIGHT);
          }
        }
      });

      it('縦ヒゲが設備行の外側の端から束ね線まで伸びる', () => {
        const { facilityY, trainY, concourseBracketY, concourseTickStartY } = layoutRows(side, 1);
        const facilityIsAbove = facilityY < trainY;

        expect(concourseTickStartY).toBe(facilityIsAbove ? facilityY : facilityY + FACILITY_ROW_HEIGHT);
        expect(Math.abs(concourseBracketY! - concourseTickStartY!)).toBeCloseTo(CONCOURSE_TICK_HEIGHT);
      });

      it('すべてのラベル段が viewBox の高さに収まる', () => {
        const { concourseSlotTops, viewHeight } = layoutRows(side, 3);

        const outOfView = concourseSlotTops.filter(
          (top) => top < 0 || top + CONCOURSE_SLOT_HEIGHT > viewHeight,
        );
        expect(outOfView).toEqual([]);
      });

      it('段どうしが重ならず、index 0 が設備行に最も近い', () => {
        const { facilityY, trainY, concourseSlotTops } = layoutRows(side, 3);
        const facilityIsAbove = facilityY < trainY;

        const distances = concourseSlotTops.map((top) =>
          facilityIsAbove ? facilityY - (top + CONCOURSE_SLOT_HEIGHT) : top - (facilityY + FACILITY_ROW_HEIGHT),
        );
        // 設備行からの距離が段番号とともに単調増加し、間隔がちょうど1段ぶん
        expect(distances).toEqual([
          CONCOURSE_TICK_HEIGHT,
          CONCOURSE_TICK_HEIGHT + CONCOURSE_SLOT_HEIGHT,
          CONCOURSE_TICK_HEIGHT + CONCOURSE_SLOT_HEIGHT * 2,
        ]);
      });
    });

    it('ラベル段も top / bottom で上下が反転する', () => {
      const top = layoutRows('top', 2);
      const bottom = layoutRows('bottom', 2);
      const mirror = (y: number, height: number) => top.viewHeight - (y + height);

      expect(top.viewHeight).toBe(bottom.viewHeight);
      expect(mirror(top.concourseBracketY!, 0)).toBeCloseTo(bottom.concourseBracketY!);
      top.concourseSlotTops.forEach((y, i) => {
        expect(mirror(y, CONCOURSE_SLOT_HEIGHT)).toBeCloseTo(bottom.concourseSlotTops[i]);
      });
    });
  });
});
