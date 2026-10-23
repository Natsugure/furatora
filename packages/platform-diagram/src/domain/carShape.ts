// 号車の外形。見本（ADR-0017 の Platform.dc.html）に合わせ、号車は角を丸めた矩形にし、
// 編成の外側の端だけを大きく丸める（先頭のノーズの多角形はやめた。Issue #174）。

/** 号車の角の丸め（メートル）。見本の 10px */
export const CAR_CORNER_RADIUS = 2;
/**
 * 編成の外側の端の丸め。見本の 26px は列車の帯の太さ（56px）のおよそ半分なので、
 * 帯の太さ（TRAIN_ROW_HEIGHT = 10m）の半分より少し小さくする
 */
export const CAR_END_RADIUS = 4.5;

export type CornerRadii = { left: number; right: number };

/**
 * 号車ごとに、左右の角の丸めを決める（純関数）。
 *
 * 外側の端は号車の番号ではなく、ホーム上の左右（startMeters）で決める。
 * 同じホームに号車の並びが逆の列車が来るので、1号車がいつも左にあるとは限らない（ADR-0022）。
 */
export function carCornerRadii(
  cars: { carNumber: number; startMeters: number; endMeters: number }[],
): Map<number, CornerRadii> {
  const byX = [...cars].sort((a, b) => a.startMeters - b.startMeters);
  const leftmost = byX[0]?.carNumber;
  const rightmost = byX[byX.length - 1]?.carNumber;

  return new Map(
    cars.map((car) => [
      car.carNumber,
      {
        left: car.carNumber === leftmost ? CAR_END_RADIUS : CAR_CORNER_RADIUS,
        right: car.carNumber === rightmost ? CAR_END_RADIUS : CAR_CORNER_RADIUS,
      },
    ]),
  );
}

/**
 * 左右で丸めの違う角丸の矩形を、SVG の path で描く。
 * `<rect rx>` は4つの角を同じにしか丸められないため。丸めは幅と高さの半分を超えない。
 */
export function roundedBarPath(
  box: { x: number; y: number; width: number; height: number },
  radii: CornerRadii,
): string {
  const { x, y, width, height } = box;
  const limit = Math.min(width, height) / 2;
  const l = Math.min(radii.left, limit);
  const r = Math.min(radii.right, limit);
  const right = x + width;
  const bottom = y + height;

  return [
    `M${x + l},${y}`,
    `H${right - r}`,
    `A${r},${r} 0 0 1 ${right},${y + r}`,
    `V${bottom - r}`,
    `A${r},${r} 0 0 1 ${right - r},${bottom}`,
    `H${x + l}`,
    `A${l},${l} 0 0 1 ${x},${bottom - l}`,
    `V${y + l}`,
    `A${l},${l} 0 0 1 ${x + l},${y}`,
    'Z',
  ].join(' ');
}
