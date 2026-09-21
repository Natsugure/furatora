// 束ね線からプレートへ降りる引き出し線を、手前のレーンのプレートを避けて通す。
//
// プレートの実幅を決めるのはCSSであり、ここで扱う箱は concourseLayout.ts の
// **幅の見積り**でしかない。見積りを外して迂回しきれなかった場合でも、
// 描画側の z-index（プレートが線より前面）が「線がプレートの上を通る」ことを防ぐ。
// ここが決めるのは経路であって、見た目の最終保証ではない。

/** ガイド線の太さ（px）。ConcoursePlateRow が描く実寸 */
export const LEADER_WIDTH_PX = 2;

/** ガイド線が1レーンを通過する区間。x は描画範囲に対する割合（0..1） */
export type LeaderSegment = {
  /** このレーンに入るx。直前のレーンの exitFraction と一致する（最初のレーンは anchorFraction） */
  enterFraction: number;
  /** このレーンを縦に降りるx */
  exitFraction: number;
  /** 迂回できる空きが無く、プレートの背面を通らざるを得なかった */
  passesBehindPlate: boolean;
};

/** レーン割り当て済みのプレート。x はすべて割合 */
export type RoutablePlate = {
  lane: number;
  anchorFraction: number;
  boxStartFraction: number;
  boxEndFraction: number;
};

export type LeaderRoute = {
  /** lane 0 .. lane-1 の通過区間。lane 0 のプレートは空配列 */
  segments: LeaderSegment[];
  /**
   * 自レーンの上端に到達するx。最後の通過区間の exitFraction（通過が無ければ anchorFraction）。
   * プレートは anchorFraction を中心に置かれるので、ここから anchorFraction へ最後の横移動が要る。
   */
  arrivalFraction: number;
};

/** 浮動小数点誤差で「ちょうど隙間の中央」が塞がり扱いになるのを避ける */
const EPSILON = 1e-9;

type Box = { start: number; end: number };

function isBlocked(x: number, boxes: Box[], clearance: number): boolean {
  return boxes.some((box) => x > box.start - clearance + EPSILON && x < box.end + clearance - EPSILON);
}

/** x から片側へ、塞がっている箱を順に乗り越えた先の最初の空き位置。上限つきで反復する */
function escape(x: number, boxes: Box[], clearance: number, direction: 'left' | 'right'): number {
  let current = x;
  for (let i = 0; i <= boxes.length; i += 1) {
    const blocking = boxes.find(
      (box) => current > box.start - clearance + EPSILON && current < box.end + clearance - EPSILON,
    );
    if (!blocking) return current;
    current = direction === 'left' ? blocking.start - clearance : blocking.end + clearance;
  }
  return current;
}

/**
 * 各プレートのガイド線が、自分より手前（図に近い）のレーンをどう通るかを決める（純関数）。
 *
 * 各レーンでは、いまのxが箱から clearanceFraction 以上離れていれば直進する。
 * ぶつかるときは左右どちらかの空きへ逃がし、両方可能なら移動量の小さい方を採る。
 * 描画範囲 [0, 1] を外れる側へは逃がさない（端寄せされたプレートは自動的に反対側へ回る）。
 * どちらにも逃がせないときはxを動かさず passesBehindPlate を立てる。
 *
 * @param clearanceFraction 線と箱の最小間隔。同一レーンのプレート間隔の半分にすると
 *   隙間のちょうど中央を通る
 * @returns 入力と同じ順序
 */
export function routeLeaders(plates: RoutablePlate[], clearanceFraction: number): LeaderRoute[] {
  return plates.map((plate) => {
    const segments: LeaderSegment[] = [];
    let x = plate.anchorFraction;

    for (let lane = 0; lane < plate.lane; lane += 1) {
      const boxes: Box[] = plates
        .filter((other) => other.lane === lane)
        .map((other) => ({ start: other.boxStartFraction, end: other.boxEndFraction }));

      if (!isBlocked(x, boxes, clearanceFraction)) {
        segments.push({ enterFraction: x, exitFraction: x, passesBehindPlate: false });
        continue;
      }

      const left = escape(x, boxes, clearanceFraction, 'left');
      const right = escape(x, boxes, clearanceFraction, 'right');
      const leftOk = left >= 0 && !isBlocked(left, boxes, clearanceFraction);
      const rightOk = right <= 1 && !isBlocked(right, boxes, clearanceFraction);

      if (!leftOk && !rightOk) {
        segments.push({ enterFraction: x, exitFraction: x, passesBehindPlate: true });
        continue;
      }

      const next = leftOk && rightOk ? (x - left <= right - x ? left : right) : leftOk ? left : right;
      segments.push({ enterFraction: x, exitFraction: next, passesBehindPlate: false });
      x = next;
    }

    return { segments, arrivalFraction: x };
  });
}
