import { describe, it, expect } from 'vitest';
import { routeLeaders, type RoutablePlate } from './leaderRoute';

const C = 0.01; // 線と箱の最小間隔

function plate(lane: number, anchor: number, start: number, end: number): RoutablePlate {
  return { lane, anchorFraction: anchor, boxStartFraction: start, boxEndFraction: end };
}

describe('routeLeaders', () => {
  it('lane 0 のプレートは通過区間を持たず、anchor に到達する', () => {
    const [route] = routeLeaders([plate(0, 0.5, 0.4, 0.6)], C);
    expect(route!.segments).toEqual([]);
    expect(route!.arrivalFraction).toBe(0.5);
  });

  it('手前のレーンが空なら直進する', () => {
    const [route] = routeLeaders([plate(1, 0.5, 0.4, 0.6)], C);
    expect(route!.segments).toEqual([{ enterFraction: 0.5, exitFraction: 0.5, passesBehindPlate: false }]);
    expect(route!.arrivalFraction).toBe(0.5);
  });

  it('手前のレーンの箱から離れていれば直進する', () => {
    const routes = routeLeaders([plate(0, 0.2, 0.1, 0.3), plate(1, 0.7, 0.6, 0.8)], C);
    expect(routes[1]!.segments[0]).toMatchObject({ exitFraction: 0.7, passesBehindPlate: false });
  });

  it('箱にぶつかると、近い方の脇へ clearance ぶん逃げる', () => {
    const routes = routeLeaders([plate(0, 0.5, 0.4, 0.6), plate(1, 0.45, 0.35, 0.55)], C);
    const segment = routes[1]!.segments[0]!;
    // 0.45 は箱 [0.4, 0.6] の内側。左端まで0.05、右端まで0.15 → 左へ
    expect(segment.exitFraction).toBeCloseTo(0.4 - C);
    expect(segment.enterFraction).toBe(0.45);
    expect(segment.passesBehindPlate).toBe(false);
    expect(routes[1]!.arrivalFraction).toBeCloseTo(0.4 - C);
  });

  it('左へ逃げると範囲外になる場合は右へ回る（start 寄せ相当）', () => {
    const routes = routeLeaders([plate(0, 0.1, 0, 0.2), plate(1, 0.05, 0, 0.15)], C);
    expect(routes[1]!.segments[0]!.exitFraction).toBeCloseTo(0.2 + C);
  });

  it('右へ逃げると範囲外になる場合は左へ回る（end 寄せ相当）', () => {
    const routes = routeLeaders([plate(0, 0.9, 0.8, 1), plate(1, 0.95, 0.85, 1)], C);
    expect(routes[1]!.segments[0]!.exitFraction).toBeCloseTo(0.8 - C);
  });

  it('隣り合う箱の隙間の中央を通る（箱間隔が 2×clearance のとき）', () => {
    const routes = routeLeaders(
      [plate(0, 0.25, 0.1, 0.39), plate(0, 0.75, 0.41, 0.9), plate(1, 0.3, 0.2, 0.4)],
      C,
    );
    // 0.3 は最初の箱の内側。右へ逃げた先 0.40 は次の箱の手前 clearance ちょうどで空き
    expect(routes[2]!.segments[0]!.exitFraction).toBeCloseTo(0.4);
    expect(routes[2]!.segments[0]!.passesBehindPlate).toBe(false);
  });

  it('複数レーンを通るとき、前レーンの exit が次レーンの enter になる', () => {
    const routes = routeLeaders(
      [plate(0, 0.5, 0.4, 0.6), plate(1, 0.9, 0.8, 1), plate(2, 0.45, 0.35, 0.55)],
      C,
    );
    const [first, second] = routes[2]!.segments;
    expect(second!.enterFraction).toBe(first!.exitFraction);
  });

  it('両側とも塞がっているときは x を動かさず passesBehindPlate を立てる', () => {
    // 左は範囲外、右は次の箱が clearance 以内に迫り抜けられない
    const routes = routeLeaders(
      [plate(0, 0.1, 0, 0.2), plate(0, 0.6, 0.2, 1), plate(1, 0.1, 0, 0.15)],
      C,
    );
    const segment = routes[2]!.segments[0]!;
    expect(segment.passesBehindPlate).toBe(true);
    expect(segment.exitFraction).toBe(0.1);
  });

  it('入力と同じ順序で返す', () => {
    const routes = routeLeaders([plate(1, 0.5, 0.4, 0.6), plate(0, 0.2, 0.1, 0.3)], C);
    expect(routes[0]!.segments).toHaveLength(1);
    expect(routes[1]!.segments).toHaveLength(0);
  });
});
