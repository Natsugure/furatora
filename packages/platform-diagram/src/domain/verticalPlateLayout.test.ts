import { describe, it, expect } from 'vitest';
import type { ConcoursePlateGroup, FacingTransferBanner } from './concourseLayout';
import { PX_PER_METER, type Bounds } from './geometry';
import {
  CONNECT_OFFSET_PX,
  GUTTER_PX,
  columnLeaderXs,
  columnSpacerHeight,
  layoutVerticalColumn,
} from './verticalPlateLayout';

const BOUNDS: Bounds = { minX: -5, maxX: 145 };

function group(concourseId: string, anchorX: number): ConcoursePlateGroup {
  return {
    concourseId,
    tickXs: [anchorX],
    bracketStartX: anchorX,
    bracketEndX: anchorX,
    anchorX,
    lane: 0,
    align: 'center',
    route: { segments: [], arrivalFraction: 0 },
    exit: '中央口',
    transfers: [],
    facilityTypeNames: [],
  };
}

function banner(key: string, startX: number, endX: number): FacingTransferBanner {
  return { key, startX, endX, lane: 0, color: '#f39700', text: '銀座線は向かい側に到着' };
}

describe('layoutVerticalColumn', () => {
  it('プレートを図の上から（x の大きい順に）並べる', () => {
    const items = layoutVerticalColumn([group('a', 20), group('b', 120), group('c', 70)], [], BOUNDS);
    expect(items.map((item) => item.key)).toEqual(['b', 'c', 'a']);
  });

  it('本来の位置は、描画範囲の上の端から下へ測った px（0m が下）', () => {
    const [item] = layoutVerticalColumn([group('a', 20)], [], BOUNDS);
    expect(item!.anchorY).toBe((145 - 20) * PX_PER_METER);
  });

  it('対面乗換の札は、範囲の上の端（x の大きい側）の位置でプレートと同じ並びに入る', () => {
    const items = layoutVerticalColumn([group('a', 20), group('b', 120)], [banner('f', 60, 100)], BOUNDS);
    expect(items.map((item) => item.key)).toEqual(['b', 'f', 'a']);
    expect(items[1]!.anchorY).toBe((145 - 100) * PX_PER_METER);
    expect(items[1]!.kind).toBe('facing');
  });

  it('プレートも札も無ければ空', () => {
    expect(layoutVerticalColumn([], [], BOUNDS)).toEqual([]);
  });
});

describe('columnSpacerHeight', () => {
  it('プレートは、線をつなぐ点が本来の位置に来るよう、その分だけ上から始まる', () => {
    const [item] = layoutVerticalColumn([group('a', 20)], [], BOUNDS);
    expect(columnSpacerHeight(item!)).toBe(item!.anchorY - CONNECT_OFFSET_PX);
  });

  it('対面乗換の札は線を持たないので、範囲の上の端からそのまま始まる', () => {
    const [item] = layoutVerticalColumn([], [banner('f', 60, 100)], BOUNDS);
    expect(columnSpacerHeight(item!)).toBe(item!.anchorY);
  });

  it('描画範囲の上の端より上には出さない', () => {
    const [item] = layoutVerticalColumn([group('a', 145)], [], BOUNDS);
    expect(columnSpacerHeight(item!)).toBe(0);
  });
});

describe('columnLeaderXs', () => {
  it('下のプレートほど縦の線を SVG に近い側（x の小さい側）へ寄せる', () => {
    const items = layoutVerticalColumn([group('a', 20), group('b', 120), group('c', 70)], [], BOUNDS);
    const xs = columnLeaderXs(items) as number[];
    expect(xs[0]!).toBeGreaterThan(xs[1]!);
    expect(xs[1]!).toBeGreaterThan(xs[2]!);
    expect(xs.every((x) => x > 0 && x < GUTTER_PX)).toBe(true);
  });

  it('対面乗換の札は線を持たず、線の間隔の割り当てにも数えない', () => {
    const plates = layoutVerticalColumn([group('a', 20), group('b', 120)], [], BOUNDS);
    const withBanner = layoutVerticalColumn([group('a', 20), group('b', 120)], [banner('f', 60, 100)], BOUNDS);
    const xs = columnLeaderXs(withBanner);
    expect(xs[1]).toBeNull();
    expect(xs.filter((x) => x !== null)).toEqual(columnLeaderXs(plates));
  });
});
