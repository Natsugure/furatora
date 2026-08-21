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

// ---- 縦方向レイアウト ----
// SVG座標系の単位はメートル（横方向と共通）。縦方向は実寸ではなく、
// 「コンコースラベル段 / 設備行 / 隙間 / 列車行」を積んだ図式的な高さである。

const MARGIN_Y = 1;
export const FACILITY_ROW_HEIGHT = 8;
/** 設備行と列車行の隙間。この領域がそのまま対面乗換帯の描画高さになる */
export const GAP_Y = 2;
export const TRAIN_ROW_HEIGHT = 10;

/** ホーム帯（[0, physicalLength] の実体）の、列車のホーム側の端からの距離と太さ */
const PLATFORM_BAR_GAP = 0.3;
export const PLATFORM_BAR_HEIGHT = 0.6;
/** 両端ラベル（0m / physicalLength m）の文字サイズ */
export const PLATFORM_LABEL_FONT_SIZE = 1.6;
// text の y はベースラインなので、ラベルをホーム帯の外側に置くための距離は
// 上下で非対称になる（下側は文字の上端ぶん、上側は下端ぶんだけ余分に要る）。
const PLATFORM_LABEL_GAP_BELOW = 2.2;
const PLATFORM_LABEL_GAP_ABOVE = 1.4;

// ---- コンコース束ね線とラベル ----
// 設備行のさらに外側（列車から遠い側）に、コンコース単位の出口・乗換ラベルを積む。

/** 設備アイコン行とブラケット横線の距離（＝縦ヒゲの長さ） */
export const CONCOURSE_TICK_HEIGHT = 2;
export const CONCOURSE_LABEL_FONT_SIZE = 2.2;
export const CONCOURSE_LABEL_LINE_HEIGHT = 2.8;
/** ラベル1段ぶんの高さ。出口行＋乗換行の2行を収める */
export const CONCOURSE_SLOT_HEIGHT = 6;

export type VerticalLayout = {
  /** SVG全体の高さ。ラベル段数に応じて伸びる（viewBox の height） */
  viewHeight: number;
  /** 設備アイコン行の上端 */
  facilityY: number;
  /** 列車行の上端 */
  trainY: number;
  /** 対面乗換帯の上端（高さは GAP_Y） */
  bandY: number;
  /** ホーム帯の上端（高さは PLATFORM_BAR_HEIGHT） */
  platformBarY: number;
  /** 両端ラベルのベースライン */
  platformLabelY: number;
  /** コンコース束ね線（横線）のy。ラベルが1つも無い場合は null */
  concourseBracketY: number | null;
  /** 縦ヒゲの起点y（設備行の外側の端）。ラベルが1つも無い場合は null */
  concourseTickStartY: number | null;
  /**
   * ラベル段ごとのブロック上端y。index 0 が設備行に最も近い段。
   * 描画側は platformSide によらず、この値から常に下向きに行を積めばよい。
   */
  concourseSlotTops: number[];
};

/**
 * platformSide（列車から見てホームがどちら側にあるか。schema: platform_side）と
 * コンコースラベルの段数から、縦方向の座標を一括で算出する（純関数）。
 *
 * 設備・ホーム帯・対面乗換帯・コンコースラベルはいずれもホーム上（またはその先）に
 * あるものなので、必ず列車行のホーム側にまとめて配置する。個別の描画箇所で side を
 * 解釈すると片方だけ反転し忘れ、要素が列車を挟んで散らばったり viewBox 外へ出たり
 * するため、side 依存の座標はすべてここで決める。
 *
 * @param labelRowCount コンコースラベルの段数。0 のときラベル領域の高さは加算せず、
 *   viewHeight はラベル導入前と完全に一致する。
 */
export function layoutRows(
  platformSide: 'top' | 'bottom' | null,
  labelRowCount = 0,
): VerticalLayout {
  const isTop = platformSide === 'top';
  const rows = Math.max(0, Math.trunc(labelRowCount));
  const concourseBlockHeight = rows > 0 ? CONCOURSE_TICK_HEIGHT + rows * CONCOURSE_SLOT_HEIGHT : 0;
  const viewHeight =
    MARGIN_Y * 2 + FACILITY_ROW_HEIGHT + GAP_Y + TRAIN_ROW_HEIGHT + concourseBlockHeight;

  const facilityY = isTop
    ? MARGIN_Y + concourseBlockHeight
    : MARGIN_Y + TRAIN_ROW_HEIGHT + GAP_Y;
  const trainY = isTop ? facilityY + FACILITY_ROW_HEIGHT + GAP_Y : MARGIN_Y;
  // 列車行のホーム側の端。ホーム上の要素はすべてこれを基準に外向きへ配置する
  const platformEdge = isTop ? trainY : trainY + TRAIN_ROW_HEIGHT;

  // 束ね線は設備行の外側端から CONCOURSE_TICK_HEIGHT だけ外側
  const bracketY = isTop
    ? facilityY - CONCOURSE_TICK_HEIGHT
    : facilityY + FACILITY_ROW_HEIGHT + CONCOURSE_TICK_HEIGHT;

  // 段は束ね線から外向きに積む。上側では上へ、下側では下へ伸びるが、
  // どちらも「返す値はブロックの上端」に揃えるので、描画側は下向きに書けばよい。
  const concourseSlotTops = Array.from({ length: rows }, (_, i) =>
    isTop ? bracketY - (i + 1) * CONCOURSE_SLOT_HEIGHT : bracketY + i * CONCOURSE_SLOT_HEIGHT,
  );

  return {
    viewHeight,
    facilityY,
    trainY,
    bandY: isTop ? trainY - GAP_Y : trainY + TRAIN_ROW_HEIGHT,
    platformBarY: isTop
      ? platformEdge - PLATFORM_BAR_GAP - PLATFORM_BAR_HEIGHT
      : platformEdge + PLATFORM_BAR_GAP,
    platformLabelY: isTop
      ? platformEdge - PLATFORM_LABEL_GAP_ABOVE
      : platformEdge + PLATFORM_LABEL_GAP_BELOW,
    concourseBracketY: rows > 0 ? bracketY : null,
    concourseTickStartY: rows > 0 ? (isTop ? facilityY : facilityY + FACILITY_ROW_HEIGHT) : null,
    concourseSlotTops,
  };
}
