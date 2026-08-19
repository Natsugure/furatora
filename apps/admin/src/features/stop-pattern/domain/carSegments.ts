// 号車ごとの停車位置（区間）を算出する純関数。
// DB・Next.js 非依存（ADR-0001: features/*/domain/ は next/* も @furatora/database も import しない）。
// アルゴリズムの根拠は docs/domain/train-stop-patterns.md「号車位置の算出」参照。

export const DEFAULT_CAR_LENGTH = 20.0;

/** x=0 に近い側の端にあるのが1号車か、最終号車か */
export type CarNumberOrder = 'carOneNearest' | 'lastCarNearest';

export type CarSegment = {
  carNumber: number;
  startMeters: number;
  endMeters: number;
};

/**
 * 編成の x=0 に近い側の端の位置（ホーム端からの距離）と号車番号の向きから、
 * 各号車の区間 [startMeters, endMeters] を算出する。
 *
 * order によらず、どの号車も startMeters < endMeters を保つ
 * （号車番号の向きが反転しても、区間そのものの向きは反転しない）。
 */
export function buildCarSegments(
  carStructure: { carNumber: number; carLength: number | null }[],
  startMeters: number,
  order: CarNumberOrder,
): CarSegment[] {
  const byCarNumber = [...carStructure].sort((a, b) => a.carNumber - b.carNumber);
  // x=0 に近い側から順に積算する
  const fromOrigin =
    order === 'carOneNearest' ? byCarNumber : [...byCarNumber].reverse();

  let cursor = startMeters;
  const segments = fromOrigin.map((car) => {
    const start = cursor;
    cursor = start + (car.carLength ?? DEFAULT_CAR_LENGTH);
    return { carNumber: car.carNumber, startMeters: start, endMeters: cursor };
  });

  return segments.sort((a, b) => a.carNumber - b.carNumber);
}
