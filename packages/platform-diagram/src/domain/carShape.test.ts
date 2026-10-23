import { describe, expect, it } from 'vitest';
import { CAR_CORNER_RADIUS, CAR_END_RADIUS, carCornerRadii, roundedBarPath } from './carShape';

const car = (carNumber: number, startMeters: number, endMeters: number) => ({ carNumber, startMeters, endMeters });

describe('carCornerRadii', () => {
  it('編成の外側の端だけを大きく丸める', () => {
    const radii = carCornerRadii([car(1, 0, 20), car(2, 20, 40), car(3, 40, 60)]);

    expect(radii.get(1)).toEqual({ left: CAR_END_RADIUS, right: CAR_CORNER_RADIUS });
    expect(radii.get(2)).toEqual({ left: CAR_CORNER_RADIUS, right: CAR_CORNER_RADIUS });
    expect(radii.get(3)).toEqual({ left: CAR_CORNER_RADIUS, right: CAR_END_RADIUS });
  });

  // 1号車が右にある編成（ADR-0022 により、号車の並びは列車によって逆になりうる）
  it('号車の番号ではなく、ホーム上の左右で外側を決める', () => {
    const radii = carCornerRadii([car(1, 40, 60), car(2, 20, 40), car(3, 0, 20)]);

    expect(radii.get(1)).toEqual({ left: CAR_CORNER_RADIUS, right: CAR_END_RADIUS });
    expect(radii.get(3)).toEqual({ left: CAR_END_RADIUS, right: CAR_CORNER_RADIUS });
  });

  it('1両だけなら両端を大きく丸める', () => {
    expect(carCornerRadii([car(1, 0, 20)]).get(1)).toEqual({ left: CAR_END_RADIUS, right: CAR_END_RADIUS });
  });
});

describe('roundedBarPath', () => {
  it('左右で丸めの違う角丸の矩形を描く', () => {
    expect(roundedBarPath({ x: 0, y: 0, width: 20, height: 10 }, { left: 4, right: 1 })).toBe(
      'M4,0 H19 A1,1 0 0 1 20,1 V9 A1,1 0 0 1 19,10 H4 A4,4 0 0 1 0,6 V4 A4,4 0 0 1 4,0 Z',
    );
  });

  it('丸めは幅と高さの半分を超えない', () => {
    expect(roundedBarPath({ x: 0, y: 0, width: 6, height: 4 }, { left: 5, right: 5 })).toBe(
      'M2,0 H4 A2,2 0 0 1 6,2 V2 A2,2 0 0 1 4,4 H2 A2,2 0 0 1 0,2 V2 A2,2 0 0 1 2,0 Z',
    );
  });

  // 管理画面では号車を 0.5m まで詰められ、号車どうしの隙間（片側 0.6m）を引くと幅が負になる。
  // SVG は弧の半径を絶対値で扱うので、負のまま描くと崩れた形が出る
  it.each([0, -0.4])('幅が %d のときは何も描かない', (width) => {
    expect(roundedBarPath({ x: 0, y: 0, width, height: 10 }, { left: 2, right: 2 })).toBe('');
  });
});
