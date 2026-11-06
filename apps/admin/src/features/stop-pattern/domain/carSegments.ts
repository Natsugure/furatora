// 新規作成のプレビュー（StopPatternCreateForm）の入力から号車の区間を作る純関数。
// DB・Next.js 非依存（ADR-0001: features/*/domain/ は next/* も @furatora/database も import しない）。
//
// 保存する基準点は「1号車の外側の端」だが（ADR-0025）、入力欄は「x=0 に近い側の端＋そこが1号車か
// 最終号車か」のままにしている。ホーム端からの距離で入れるほうが、構内図から読み取りやすいため。
// 区間の算出は保存・読み取りと同じ carSegmentsFromCarOne に寄せる。
import {
  carSegmentsFromCarOne, DEFAULT_CAR_LENGTH, type CarLengthSpec, type CarSegment,
} from '@furatora/platform-diagram/domain';
import type { CarNumbersAscendToward } from '@furatora/database/enums';

export type { CarSegment };

/** x=0 に近い側の端にあるのが1号車か、最終号車か */
export type CarNumberOrder = 'carOneNearest' | 'lastCarNearest';

export function ascendTowardOf(order: CarNumberOrder): CarNumbersAscendToward {
  return order === 'carOneNearest' ? 'plusX' : 'minusX';
}

/**
 * 編成の x=0 に近い側の端の位置（nearEdgeMeters）と号車番号の向きから、各号車の区間を算出する。
 * x=0 側が最終号車のときは、1号車の外側の端 = nearEdgeMeters + 編成の全長 になる。
 */
export function buildCarSegments(
  carStructure: CarLengthSpec[],
  nearEdgeMeters: number,
  order: CarNumberOrder,
): CarSegment[] {
  const totalLength = carStructure.reduce((sum, car) => sum + (car.carLength ?? DEFAULT_CAR_LENGTH), 0);
  const carOneOuterMeters = order === 'carOneNearest' ? nearEdgeMeters : nearEdgeMeters + totalLength;
  return carSegmentsFromCarOne(carStructure, carOneOuterMeters, ascendTowardOf(order));
}
