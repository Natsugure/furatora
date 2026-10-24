import type { ConcoursePlateGroup, FacingTransferBanner } from './concourseLayout';
import { verticalY, type Bounds } from './geometry';

/**
 * 縦の図の、プレートの列に積むもの（出口・乗換のプレートと対面乗換の札）。
 *
 * 縦の図は横の図を左へ90°回したもので、0m が下にある（ADR-0023）。
 * 列はひとつで、上から順に積む。上端は「本来の位置か、上のものに押し下げられた位置」になり、
 * それは CSS が決める（VerticalPlateColumn）。ここでは並びと本来の位置だけを決める。
 */
export type VerticalColumnItem =
  | { kind: 'plate'; key: string; anchorY: number; group: ConcoursePlateGroup }
  | { kind: 'facing'; key: string; anchorY: number; banner: FacingTransferBanner };

/**
 * プレートと札を、本来の位置の上から順に並べる（純関数）。
 *
 * 札は範囲の上の端（x の大きい側）に置く。範囲そのものは SVG のティントが示すので、
 * 札はその始まりに並べば「この区間のことだ」が読み取れる。
 */
export function layoutVerticalColumn(
  groups: ConcoursePlateGroup[],
  banners: FacingTransferBanner[],
  bounds: Bounds,
): VerticalColumnItem[] {
  const items: VerticalColumnItem[] = [
    ...groups.map((group) => ({
      kind: 'plate' as const,
      key: group.concourseId,
      anchorY: verticalY(group.anchorX, bounds),
      group,
    })),
    ...banners.map((banner) => ({
      kind: 'facing' as const,
      key: banner.key,
      anchorY: verticalY(banner.endX, bounds),
      banner,
    })),
  ];
  return items.sort((a, b) => a.anchorY - b.anchorY);
}

/** 本来の位置からプレートの中へ線をつなぐ点までの距離（プレートの上端から）。押し下げられなければ線は真横になる */
export const CONNECT_OFFSET_PX = 14;
/** SVG とプレートの間の、折れ線の縦の部分が走る列の幅 */
export const GUTTER_PX = 20;

/**
 * 列の中で、そのものの上に空ける高さ（押し下げられないときの上端）。
 *
 * プレートは線をつなぐ点が本来の位置に来るよう CONNECT_OFFSET_PX だけ上から始める。
 * 札は線を持たず、範囲の上の端に並ぶことで区間を示すので、本来の位置からそのまま始める。
 */
export function columnSpacerHeight(item: VerticalColumnItem): number {
  const offset = item.kind === 'plate' ? CONNECT_OFFSET_PX : 0;
  return Math.max(0, item.anchorY - offset);
}

/**
 * 各プレートの折れ線の縦の部分の x（余白の列の左端から）。札は線を持たないので null。
 *
 * 下のプレートほど SVG に近い側へ寄せる。押し下げが連なっても、線どうしが交わらない。
 * 間隔はプレートの数だけで割る（札に枠を割くと、線どうしが無駄に近づく）。
 */
export function columnLeaderXs(items: VerticalColumnItem[]): (number | null)[] {
  const plateCount = items.filter((item) => item.kind === 'plate').length;
  let plateIndex = 0;
  return items.map((item) => {
    if (item.kind !== 'plate') return null;
    plateIndex += 1;
    return GUTTER_PX - (plateIndex * GUTTER_PX) / (plateCount + 1);
  });
}
