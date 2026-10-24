import type { CSSProperties, ReactNode } from 'react';
import type { ConcoursePlateGroup, FacingTransferBanner } from '../../domain/concourseLayout';
import type { Bounds } from '../../domain/geometry';
import { LEADER_WIDTH_PX } from '../../domain/leaderRoute';
import { layoutVerticalColumn } from '../../domain/verticalPlateLayout';
import { PlateStack } from './ConcoursePlateRow';
import { FacingTransferTag } from './FacingTransferTagRow';

// 縦の図の、出口・乗換のプレートと対面乗換の札の列。並びと本来の位置は layoutVerticalColumn() が決める。
//
// プレートを上から順に1列に積み、プレート i の上端を
//   top_i = max(本来の位置, 上のプレートの下端 + 隙間)
// にする。実測せず CSS だけで作るため、入れ子の単一セル grid を使う:
//   N_i = grid[ 本来の位置までの空き | N_{i-1}・プレート i-1・隙間 ]
// 単一セルの grid は重ねた中身のうち高いほうの高さになるので、N_i の直後に置いたプレート i の上端が max になる。
//
// 折れ線は N_i の中に絶対配置で置く。top を本来の位置、bottom を N_i の下端（＝プレートの上端の近く）にすれば、
// 押し下げられた長さを測らずに結べる（ADR-0006 の範囲。実測しない）。
// 対面乗換の札には引き出し線を付けない（範囲は SVG のティントが示し、札はその上の端に並ぶ）。

/** 本来の位置からプレートの中へ線をつなぐ点までの距離（プレートの上端から）。押し下げられなければ線は真横になる */
const CONNECT_OFFSET_PX = 14;
/** SVG とプレートの間の、折れ線の縦の部分が走る列の幅 */
const GUTTER_PX = 20;
const PLATE_GAP_PX = 6;

type Props = {
  groups: ConcoursePlateGroup[];
  facingBanners: FacingTransferBanner[];
  bounds: Bounds;
};

export function VerticalPlateColumn({ groups, facingBanners, bounds }: Props) {
  const items = layoutVerticalColumn(groups, facingBanners, bounds);
  if (items.length === 0) return null;

  // 下のプレートほど縦の線を SVG に近い側へ寄せる。押し下げが連なっても、線どうしが交わらない
  const leaderXs = items.map((_, i) => GUTTER_PX - ((i + 1) * GUTTER_PX) / (items.length + 1));

  const stack = items.reduce<ReactNode>((inner, item, i) => {
    const spacer = Math.max(0, item.anchorY - CONNECT_OFFSET_PX);
    return (
      <>
        <div className="relative grid grid-cols-[minmax(0,1fr)]">
          <div style={{ gridArea: '1 / 1', height: spacer }} />
          {inner !== null && <div style={{ gridArea: '1 / 1', paddingBottom: PLATE_GAP_PX }}>{inner}</div>}
          {item.kind === 'plate' && <Leader anchorY={item.anchorY} x={leaderXs[i]!} />}
        </div>
        <div style={{ paddingInlineStart: GUTTER_PX }}>
          {item.kind === 'plate' ? (
            <PlateStack group={item.group} className="w-max max-w-full" />
          ) : (
            <FacingTransferTag banner={item.banner} style={{ width: 'max-content', maxWidth: '100%' }} />
          )}
        </div>
      </>
    );
  }, null);

  return (
    <div className="min-w-0 flex-1" style={{ fontFamily: 'var(--font-sign)' }}>
      {stack}
    </div>
  );
}

const line: CSSProperties = { position: 'absolute', backgroundColor: 'var(--sign-leader)' };

/** SVG の右端 → 余白の列の x → 下へ → プレートの左の縁 */
function Leader({ anchorY, x }: { anchorY: number; x: number }) {
  const half = LEADER_WIDTH_PX / 2;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <span style={{ ...line, top: anchorY - half, left: 0, width: x + half, height: LEADER_WIDTH_PX }} />
      <span
        style={{ ...line, top: anchorY - half, bottom: -CONNECT_OFFSET_PX - half, left: x - half, width: LEADER_WIDTH_PX }}
      />
      <span
        style={{
          ...line,
          bottom: -CONNECT_OFFSET_PX - half,
          left: x - half,
          width: GUTTER_PX - x + half,
          height: LEADER_WIDTH_PX,
        }}
      />
    </div>
  );
}
