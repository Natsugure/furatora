import type { ConcourseDTO, TrainStopPatternDTO } from './types';

// SVG viewBox の左右に余白として加えるマージン（メートル）。
export const MARGIN_METERS = 5;

export type Bounds = { minX: number; maxX: number };

/**
 * ホーム物理長・全停車位置パターン・全設備・全対面乗換帯の座標から
 * SVG viewBox の描画範囲を算出する（純関数・DB非依存）。
 *
 * [0, physicalLength] は常に描画範囲に含める（ホームの実体そのものであるため。
 * docs/domain/platform-coordinate-system.md「座標の範囲」）。
 */
export function computeBounds(
  physicalLength: number,
  patterns: Pick<TrainStopPatternDTO, 'cars'>[],
  concourses: Pick<ConcourseDTO, 'cells' | 'connections'>[],
): Bounds {
  const candidates: number[] = [0, physicalLength];

  for (const pattern of patterns) {
    for (const car of pattern.cars) {
      candidates.push(car.startMeters, car.endMeters);
    }
  }

  for (const concourse of concourses) {
    for (const cell of concourse.cells) {
      if (cell.xPositionMeters !== null) {
        candidates.push(cell.xPositionMeters);
      }
    }
    for (const connection of concourse.connections) {
      if (connection.xRangeStart !== null && connection.xRangeEnd !== null) {
        candidates.push(connection.xRangeStart, connection.xRangeEnd);
      }
    }
  }

  const minX = Math.min(...candidates) - MARGIN_METERS;
  const maxX = Math.max(...candidates) + MARGIN_METERS;

  return { minX, maxX };
}
