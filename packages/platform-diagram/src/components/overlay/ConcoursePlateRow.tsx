import type { CSSProperties } from 'react';
import { transferNote, type ConcoursePlateGroup } from '../../domain/concourseLayout';
import type { TransferEntry } from '../../domain/concourse';
import { xFraction, type Bounds } from '../../domain/geometry';
import { LEADER_WIDTH_PX } from '../../domain/leaderRoute';

// 出口・乗換のプレート。SVGではなくHTMLなので、文字は折り返すだけで一切切り詰めない。
//
// 各レーンは「単一セルの grid」にしてある。同じセルに置かれた grid item は
// 全員が行の高さに寄与するので、レーンの高さが中身に合わせて自動で決まる。
// 絶対配置だと高さに寄与せず、行高をサーバ側で推定する羽目になり、
// 推定を外した瞬間に段が重なって読めなくなる（docs/adr/0006）。

type Props = {
  groups: ConcoursePlateGroup[];
  laneCount: number;
  bounds: Bounds;
  /** 図がこのブロックの下にある（＝lane 0 を最後に描く）か */
  reverseLanes: boolean;
};

/** アンカーのx割合をCSSのパーセントに写す */
function percentOf(x: number, bounds: Bounds): string {
  return `${xFraction(x, bounds) * 100}%`;
}

/** 描画範囲に対する割合（0..1）をCSSのパーセントに写す。経路の値はすでに割合 */
function fractionPct(fraction: number): string {
  return `${fraction * 100}%`;
}

/** 全幅・行高いっぱいの空レイヤ。grid item なので行の高さには寄与しない */
const layerStyle: CSSProperties = {
  gridArea: '1 / 1',
  position: 'relative',
  alignSelf: 'stretch',
  pointerEvents: 'none',
};

/**
 * このレーンの余白帯を走る横線の区間。
 *
 * 通過するレーンでは enter→exit、自レーンでは最後の到達位置→anchor（プレート中心）。
 * 手前のレーンを通らない（lane 0）プレートは、線が最初から anchor にあるので横線は要らない。
 */
function jogAt(group: ConcoursePlateGroup, lane: number, bounds: Bounds): { from: number; to: number } | null {
  const segment = group.route.segments[lane];
  if (segment) return { from: segment.enterFraction, to: segment.exitFraction };
  if (lane === group.lane) return { from: group.route.arrivalFraction, to: xFraction(group.anchorX, bounds) };
  return null;
}

/**
 * プレートの水平位置。
 *
 * 中央寄せは「アンカーを中心に置く」＝ margin で左端まで送ってから半分戻す。
 * 端に寄せる場合は translate を打ち消す（左は切り落とされ、右はスクロール領域を
 * 無駄に広げるため、はみ出させない）。
 */
function plateStyle(group: ConcoursePlateGroup, bounds: Bounds): CSSProperties {
  if (group.align === 'start') return { marginInlineStart: 0 };
  if (group.align === 'end') return { marginInlineStart: 'auto', justifySelf: 'end' };
  return { marginInlineStart: percentOf(group.anchorX, bounds), transform: 'translateX(-50%)' };
}

export function ConcoursePlateRow({ groups, laneCount, bounds, reverseLanes }: Props) {
  if (groups.length === 0) return null;

  // lane 0 が常に図に接するように並べる
  const lanes = Array.from({ length: laneCount }, (_, i) => (reverseLanes ? laneCount - 1 - i : i));

  return (
    <div className="flex flex-col" style={{ fontFamily: 'var(--font-sign)' }}>
      {lanes.map((lane) => (
        <div key={lane} className="grid">
          {/* ガイド線は3枚のレイヤに分ける。いずれも全幅・行高いっぱいに伸ばした空の
              grid item なので、行の高さには寄与しない（プレートだけが高さを決める）。
              中の線は left の割合で置くため、SVGの束ね線と同じ xFraction に乗る。

              重なり順は transform の有無に左右されないよう z-index で明示する:
              縦線(0) < プレート(1) < 余白帯の横線(2)。迂回しきれなかった場合でも
              線がプレートの文字を覆うことはない */}
          <div aria-hidden style={{ ...layerStyle, zIndex: 0 }}>
            {groups.map((group) => {
              const segment = group.route.segments[lane];
              if (!segment) return null;
              return (
                <span
                  key={`stem-${group.concourseId}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: fractionPct(segment.exitFraction),
                    width: LEADER_WIDTH_PX,
                    marginLeft: -LEADER_WIDTH_PX / 2,
                    backgroundColor: 'var(--sign-leader)',
                  }}
                />
              );
            })}
          </div>

          {/* 横線は、そのレーンの図に近い側の余白帯（プレート箱の外）だけを走る。
              自レーンでは、迂回で anchor からずれた線をプレートの中心へ戻す */}
          <div aria-hidden style={{ ...layerStyle, zIndex: 2 }}>
            {groups.flatMap((group) => {
              const jog = jogAt(group, lane, bounds);
              if (jog === null || jog.from === jog.to) return [];
              return [
                <span
                  key={`jog-${group.concourseId}`}
                  style={{
                    position: 'absolute',
                    ...(reverseLanes ? { bottom: 0 } : { top: 0 }),
                    left: fractionPct(Math.min(jog.from, jog.to)),
                    // 縦線の太さぶん両端を延ばし、角に欠けを作らない
                    width: `calc(${fractionPct(Math.abs(jog.to - jog.from))} + ${LEADER_WIDTH_PX}px)`,
                    height: LEADER_WIDTH_PX,
                    marginLeft: -LEADER_WIDTH_PX / 2,
                    backgroundColor: 'var(--sign-leader)',
                  }}
                />,
              ];
            })}
          </div>

          {groups
            .filter((group) => group.lane === lane)
            .map((group) => (
              <div
                key={group.concourseId}
                className={`flex flex-col gap-1 ${reverseLanes ? 'pb-1.5' : 'pt-1.5'}`}
                style={{
                  gridArea: '1 / 1',
                  zIndex: 1,
                  justifySelf: 'start',
                  // max-content の明示は必須。省略すると fit-content になり、
                  // 右寄りのプレートが「残り幅」に潰されて過剰に折り返す
                  width: 'max-content',
                  maxWidth: 'min(220px, 100%)',
                  ...plateStyle(group, bounds),
                }}
              >
                {group.exit !== null && (
                  <ExitPlate exit={group.exit} facilityTypeNames={group.facilityTypeNames} />
                )}
                {group.transfers.length > 0 && <TransferPlate transfers={group.transfers} />}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

/**
 * 出口プレート（黄地に黒）。
 *
 * 設備の種別名を添えるのは、束ね線と出口の対応を**文章でも**担保するため。
 * 引き出し線は幅の見積り誤差ぶんずれうるが、「このエレベーターは中央改札へ」が
 * 文字で読めれば対応関係は失われない。
 */
function ExitPlate({ exit, facilityTypeNames }: { exit: string; facilityTypeNames: string[] }) {
  return (
    <div
      className="rounded-md px-2.5 py-1.5 text-[13px] font-bold leading-snug"
      style={{
        backgroundColor: 'var(--sign-exit-bg)',
        color: 'var(--sign-exit-ink)',
        border: '1px solid var(--sign-exit-edge)',
      }}
    >
      {exit}
      {facilityTypeNames.length > 0 && (
        <span className="mt-0.5 block text-[11px] font-normal opacity-75">
          {facilityTypeNames.join('・')}から
        </span>
      )}
    </div>
  );
}

/** 乗換プレート（白地に黒枠）。路線は1件ずつ色チップ付きで縦に並べ、畳まない */
function TransferPlate({ transfers }: { transfers: TransferEntry[] }) {
  return (
    <div
      className="rounded-md px-2.5 py-1.5 text-[13px] leading-snug"
      style={{
        backgroundColor: 'var(--sign-transfer-bg)',
        color: 'var(--sign-transfer-ink)',
        border: '2px solid var(--sign-transfer-edge)',
      }}
    >
      <ul className="flex flex-col gap-1">
        {transfers.map((transfer, index) => {
          const note = transferNote(transfer);
          return (
            <li key={index} className="flex flex-col gap-0.5">
              {transfer.lines.map((line) => (
                <span key={line.name} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: line.color }}
                  />
                  {line.name}
                </span>
              ))}
              {note !== null && (
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--sign-transfer-note)' }}
                >
                  {note}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
