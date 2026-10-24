import { describe, it, expect } from 'vitest';
import {
  computeBounds,
  facilityIconHalfExtent,
  layoutRows,
  toVertical,
  verticalMatrix,
  verticalY,
  xFraction,
  PX_PER_METER,
  FACILITY_ICON_SIZE,
  FACILITY_ROW_HEIGHT,
  GAP_Y,
  MARGIN_METERS,
  PLATFORM_BAR_HEIGHT,
  PLATFORM_LABEL_FONT_SIZE,
  TRAIN_ROW_HEIGHT,
  CONCOURSE_TICK_HEIGHT,
  DOOR_MARK_THICKNESS,
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
  cells: { xPositionMeters: number | null; facilityCount?: number }[],
  connections: { xRangeStart: number | null; xRangeEnd: number | null }[] = [],
): Pick<ConcourseDTO, 'cells' | 'connections'> {
  return {
    cells: cells.map(({ xPositionMeters, facilityCount = 0 }) => ({
      xPositionMeters,
      facilities: Array.from({ length: facilityCount }, (_, i) => ({
        id: `f${i}`,
        typeCode: 'elevator',
        typeName: 'エレベーター',
        isWheelchairAccessible: null,
        isStrollerAccessible: null,
      })),
    })),
    connections: connections.map((c) => ({
      ...c,
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

describe('設備アイコンの張り出し', () => {
  it('facilityIconHalfExtent は件数ごとに扇状配置の半幅を返す', () => {
    expect(facilityIconHalfExtent(0)).toBe(0);
    expect(facilityIconHalfExtent(1)).toBe(FACILITY_ICON_SIZE / 2);
    expect(facilityIconHalfExtent(2)).toBeCloseTo(6.5);
    expect(facilityIconHalfExtent(3)).toBeCloseTo(10);
  });

  it('設備1件のアクセス点はアイコン半幅ぶん範囲が広がる', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: 150, facilityCount: 1 }])]);
    expect(bounds.maxX).toBeCloseTo(150 + 3 + MARGIN_METERS);
  });

  it('設備2件のアクセス点は ±6.5m 広がり、MARGIN_METERS を超える', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: 150, facilityCount: 2 }])]);
    expect(bounds.maxX).toBeCloseTo(150 + 6.5 + MARGIN_METERS);
    expect(6.5).toBeGreaterThan(MARGIN_METERS);
  });

  it('左端（負座標）のアクセス点も張り出しぶん広がる', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: -20, facilityCount: 3 }])]);
    expect(bounds.minX).toBeCloseTo(-20 - 10 - MARGIN_METERS);
  });

  it('設備0件のアクセス点は従来どおり座標そのもの', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: 150, facilityCount: 0 }])]);
    expect(bounds.maxX).toBe(150 + MARGIN_METERS);
  });

  it('xPositionMeters が null のセルは設備があっても範囲計算の対象外', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: null, facilityCount: 3 }])]);
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });
});

describe('layoutRows', () => {
  // ラベルの text.y はベースライン。実際の文字の張り出しはフォント依存なので、
  // 一般的な欧文フォントの ascent/descent を上回る値で概算し、安全側に倒す。
  const labelExtent = (platformLabelY: number) => ({
    top: platformLabelY - PLATFORM_LABEL_FONT_SIZE,
    bottom: platformLabelY + PLATFORM_LABEL_FONT_SIZE * 0.3,
  });

  // 原点は「線路に向かって立ったときの左の端」で、図は線路に向かって立った見え方で描く（ADR-0022）。
  // 列車が上（奥）、ホーム上のものはすべて列車の下（手前）に来る。ホームの側による分岐は無い。
  // 値は ADR-0022 以前に下側だったホームと同じで、そのホームの見え方が変わらないことの証拠でもある
  it('上から 列車行 → 隙間 → 設備行 の順に積む', () => {
    expect(layoutRows()).toEqual({
      viewHeight: 22,
      facilityY: 13,
      trainY: 1,
      facingBandY: 11,
      facingBandHeight: 10,
      platformBarY: 11.6,
      platformLabelY: 13.4,
      concourseBracketY: null,
      concourseTickStartY: null,
    });
  });

  it('すべての描画要素が viewBox の高さに収まる', () => {
    const { facilityY, trainY, facingBandY, facingBandHeight, platformBarY, platformLabelY, viewHeight } =
      layoutRows();
    const label = labelExtent(platformLabelY);

    const spans: [string, number, number][] = [
      ['設備行', facilityY, facilityY + FACILITY_ROW_HEIGHT],
      ['列車行', trainY, trainY + TRAIN_ROW_HEIGHT],
      ['対面乗換ティント', facingBandY, facingBandY + facingBandHeight],
      ['ホーム帯', platformBarY, platformBarY + PLATFORM_BAR_HEIGHT],
      ['両端ラベル', label.top, label.bottom],
    ];

    const outOfView = spans.filter(([, top, bottom]) => top < 0 || bottom > viewHeight).map(([name]) => name);
    expect(outOfView).toEqual([]);
  });

  it('設備行が列車行の下にあり、重ならない', () => {
    const { facilityY, trainY } = layoutRows();
    expect(trainY + TRAIN_ROW_HEIGHT).toBeLessThanOrEqual(facilityY);
  });

  it('対面乗換ティントが列車の下端から設備行の下端までを覆う', () => {
    const { facilityY, trainY, facingBandY, facingBandHeight } = layoutRows();

    expect(facingBandY).toBeCloseTo(trainY + TRAIN_ROW_HEIGHT);
    expect(facingBandY + facingBandHeight).toBeCloseTo(facilityY + FACILITY_ROW_HEIGHT);
    // 隙間だけでなく設備行ぶんも覆っている
    expect(facingBandHeight).toBeCloseTo(GAP_Y + FACILITY_ROW_HEIGHT);
  });

  it('ホーム帯が対面乗換ティントの範囲に含まれる', () => {
    const { facingBandY, facingBandHeight, platformBarY } = layoutRows();

    expect(platformBarY).toBeGreaterThanOrEqual(facingBandY);
    expect(platformBarY + PLATFORM_BAR_HEIGHT).toBeLessThanOrEqual(facingBandY + facingBandHeight);
  });

  it('ホーム帯と両端ラベルが列車の下端より下にある', () => {
    const { trainY, platformBarY, platformLabelY } = layoutRows();

    expect(platformBarY).toBeGreaterThanOrEqual(trainY + TRAIN_ROW_HEIGHT);
    expect(labelExtent(platformLabelY).top).toBeGreaterThanOrEqual(trainY + TRAIN_ROW_HEIGHT);
  });

  // ドアの棒は号車のホーム側の縁をまたいで置く。帯がその上に乗ると、棒が帯の目盛りに見える
  it('ホーム帯がドアの棒に重ならない', () => {
    const { trainY, platformBarY } = layoutRows();
    expect(platformBarY).toBeGreaterThanOrEqual(trainY + TRAIN_ROW_HEIGHT + DOOR_MARK_THICKNESS / 2);
  });

  it('両端ラベルが設備の札に重ならない', () => {
    const { facilityY, platformLabelY } = layoutRows();
    const tileTop = facilityY + (FACILITY_ROW_HEIGHT - FACILITY_ICON_SIZE) / 2;
    expect(labelExtent(platformLabelY).bottom).toBeLessThanOrEqual(tileTop);
  });

  // 文字の張り出しぶんまではフォント依存で厳密に保証できないため、
  // ベースラインがホーム帯の外側にあること（= 文字が帯の上に乗らないこと）を見る。
  it('両端ラベルのベースラインがホーム帯の外側にある', () => {
    const { platformBarY, platformLabelY } = layoutRows();
    expect(platformLabelY).toBeGreaterThanOrEqual(platformBarY + PLATFORM_BAR_HEIGHT);
  });

  describe('コンコース束ね線', () => {
    it('束ね線が無いとき高さは加算されず、束ね線も引かない', () => {
      const layout = layoutRows({ hasConcourseLeaders: false });

      expect(layout.concourseBracketY).toBeNull();
      expect(layout.concourseTickStartY).toBeNull();
      // 束ね線導入前の高さ（マージン2 + 設備8 + 隙間2 + 列車10）と一致する
      expect(layout.viewHeight).toBe(2 + FACILITY_ROW_HEIGHT + GAP_Y + TRAIN_ROW_HEIGHT);
    });

    it('オプションを省略した場合は束ね線無しとして扱う', () => {
      expect(layoutRows()).toEqual(layoutRows({ hasConcourseLeaders: false }));
    });

    // ラベルはSVGの外（HTMLオーバーレイ）にあるので、件数がいくら増えても
    // SVGの高さは変わらない。これが段を積んでいた頃との決定的な違い。
    it('束ね線があるとき viewHeight はヒゲぶんだけ伸び、コンコースの件数に依存しない', () => {
      expect(layoutRows({ hasConcourseLeaders: true }).viewHeight).toBe(
        2 + FACILITY_ROW_HEIGHT + GAP_Y + TRAIN_ROW_HEIGHT + CONCOURSE_TICK_HEIGHT,
      );
    });

    it('縦ヒゲが設備行の下端から伸び、その下に束ね線がある', () => {
      const { facilityY, concourseBracketY, concourseTickStartY } = layoutRows({ hasConcourseLeaders: true });

      expect(concourseTickStartY).toBe(facilityY + FACILITY_ROW_HEIGHT);
      expect(concourseBracketY! - concourseTickStartY!).toBeCloseTo(CONCOURSE_TICK_HEIGHT);
    });

    it('束ね線が viewBox の高さに収まる', () => {
      const { concourseBracketY, viewHeight } = layoutRows({ hasConcourseLeaders: true });

      expect(concourseBracketY!).toBeGreaterThanOrEqual(0);
      expect(concourseBracketY!).toBeLessThanOrEqual(viewHeight);
    });
  });
});

describe('xFraction', () => {
  const bounds = { minX: -20, maxX: 320 };

  it('描画範囲の両端を0と1に写す', () => {
    expect(xFraction(-20, bounds)).toBe(0);
    expect(xFraction(320, bounds)).toBe(1);
  });

  it('中点を0.5に写す', () => {
    expect(xFraction(150, bounds)).toBeCloseTo(0.5);
  });

  it('範囲外の座標も線形に写す（クランプしない）', () => {
    // 範囲外の設備も描画対象に含める仕様なので、0..1 の外へ出ることを許容する
    expect(xFraction(-360, bounds)).toBeCloseTo(-1);
    expect(xFraction(660, bounds)).toBeCloseTo(2);
  });

  it('幅が0に縮退した場合は0を返す', () => {
    expect(xFraction(5, { minX: 5, maxX: 5 })).toBe(0);
  });
});

describe('縦の図の写像（verticalMatrix / toVertical）', () => {
  const bounds = { minX: -5, maxX: 145 };
  const rows = layoutRows();

  it('0m が下、ホーム長の端が上に来る', () => {
    expect(toVertical({ x: 0, y: 0 }, bounds).y).toBeGreaterThan(toVertical({ x: 140, y: 0 }, bounds).y);
  });

  it('描画範囲の上の端が y=0、下の端が y=描画範囲の長さ', () => {
    expect(toVertical({ x: 145, y: 0 }, bounds).y).toBe(0);
    expect(toVertical({ x: -5, y: 0 }, bounds).y).toBe(150);
  });

  it('列車が左、設備が右に来る', () => {
    expect(toVertical({ x: 70, y: rows.trainY }, bounds).x).toBeLessThan(
      toVertical({ x: 70, y: rows.facilityY }, bounds).x,
    );
  });

  it('回すだけで、鏡写しにしない（行列式が +1）', () => {
    const [a, b, c, d] = verticalMatrix(bounds);
    expect(a * d - b * c).toBe(1);
  });

  it('プレートの列の y（px）は、描画範囲の上の端からの距離に PX_PER_METER を掛けたもの', () => {
    expect(verticalY(20, bounds)).toBe((145 - 20) * PX_PER_METER);
  });
});
