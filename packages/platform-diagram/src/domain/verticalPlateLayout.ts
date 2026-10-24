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
