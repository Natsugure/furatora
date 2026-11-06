// 停車位置パターンの号車の区間を、号車構成と基準点から算出する純関数（DB非依存）。
// パターンは「1号車の外側の端」と「号車番号の向き」だけを持ち、区間は保存しない
// （ADR-0025、docs/domain/train-stop-patterns.md「号車位置の算出」）。
// Web・Admin の両方の読み取りと、Admin の編集が同じ関数を使う。
import type { CarNumbersAscendToward } from '@furatora/database/enums';
import { roundToDecimal2 } from './snap';

// アプリの components 層は @furatora/database/enums を直接 import できないため、ここから渡す
export type { CarNumbersAscendToward };

/** trainCarStructures.carLength が未指定（null）の号車の長さ（m） */
export const DEFAULT_CAR_LENGTH = 20.0;

export type CarLengthSpec = { carNumber: number; carLength: number | null };

export type CarSegment = { carNumber: number; startMeters: number; endMeters: number };

/**
 * 1号車の外側の端（carOneOuterMeters）から、号車番号の向きへ carLength を積んで区間を返す。
 * 向きによらず、どの号車も startMeters < endMeters を保つ。carNumber 昇順で返す。
 *
 * 各端は小数2桁に丸める。保存先・座標系の精度（decimal(6,2)）に合わせ、
 * 浮動小数の誤差で隣接号車の境界がずれないようにするため（積算した値を丸めるので、
 * 境界は隣どうしで常に同じ値になる）。
 */
export function carSegmentsFromCarOne(
  carStructure: CarLengthSpec[],
  carOneOuterMeters: number,
  ascendToward: CarNumbersAscendToward,
): CarSegment[] {
  const sign = ascendToward === 'plusX' ? 1 : -1;
  const byCarNumber = [...carStructure].sort((a, b) => a.carNumber - b.carNumber);

  let cursor = carOneOuterMeters;
  return byCarNumber.map((car) => {
    const near = roundToDecimal2(cursor);
    cursor += sign * (car.carLength ?? DEFAULT_CAR_LENGTH);
    const far = roundToDecimal2(cursor);
    return {
      carNumber: car.carNumber,
      startMeters: Math.min(near, far),
      endMeters: Math.max(near, far),
    };
  });
}

/**
 * 号車構成が未登録の列車を、carCount 両の標準構成として扱うための構成を返す。
 * 読み取り（区間の算出）と Admin の新規作成のプレビューが同じ補い方をする。
 */
export function standardCarStructure(carCount: number): CarLengthSpec[] {
  return Array.from({ length: carCount }, (_, i) => ({ carNumber: i + 1, carLength: null }));
}

/**
 * 区間から基準点（1号車の外側の端）を戻す。carSegmentsFromCarOne の逆で、
 * Admin が平行移動した区間を保存するときに使う。1号車が無ければ null。
 */
export function carOneAnchorOf(
  cars: CarSegment[],
  ascendToward: CarNumbersAscendToward,
): number | null {
  const carOne = cars.find((c) => c.carNumber === 1);
  if (!carOne) return null;
  return ascendToward === 'plusX' ? carOne.startMeters : carOne.endMeters;
}

/** trainCarStructures が未登録の号車のドア数。Web・Admin の表示で同じ値を使う */
export const DEFAULT_DOOR_COUNT = 4;

export type PatternAnchor = {
  carOneOuterMeters: number | null;
  carNumbersAscendToward: CarNumbersAscendToward | null;
};

/**
 * 1つの停車位置パターンの号車（区間とドア数）を、列車の号車構成から解決する。
 * 号車構成が1件も無い列車は carCount 両の標準構成として扱う。
 *
 * 基準点か向きが null のパターンは null を返し、呼び出し側は表示しない。二段階の移行の
 * 1段目のあいだに旧コードが作った行で、2段目で旧表から埋め直す（ADR-0025）。
 */
export function resolvePatternCars(
  carStructure: (CarLengthSpec & { doorCount: number })[],
  carCount: number,
  anchor: PatternAnchor,
): (CarSegment & { doorCount: number })[] | null {
  if (anchor.carOneOuterMeters === null || anchor.carNumbersAscendToward === null) return null;
  const structure = carStructure.length > 0
    ? carStructure
    : standardCarStructure(carCount).map((c) => ({ ...c, doorCount: DEFAULT_DOOR_COUNT }));
  const doorCountByCar = new Map(structure.map((c) => [c.carNumber, c.doorCount]));
  return carSegmentsFromCarOne(structure, anchor.carOneOuterMeters, anchor.carNumbersAscendToward)
    .map((segment) => ({ ...segment, doorCount: doorCountByCar.get(segment.carNumber) ?? DEFAULT_DOOR_COUNT }));
}
