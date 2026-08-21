import { connectionLabels, connectionShortLabels, exitsLabel } from './concourse';
import { CONCOURSE_LABEL_FONT_SIZE, type Bounds } from './geometry';
import type { ConcourseDTO } from './types';

// コンコース単位の出口・乗換ラベルを、ホーム座標系（メートル）のどこに置くかを決める。
// 段の割り当てと文字数の省略は分岐が多く、SVGのJSXに埋めるとテストできないため、
// computeBounds() / layoutRows() と同じく domain 側の純関数として切り出す（ADR-0001）。

/** ラベル1件の最大幅。5px/m 換算で 220px */
export const MAX_LABEL_WIDTH_METERS = 44;
/** 同じ段に並ぶラベルどうしの最小間隔。文字幅推定のずれもここで吸収する */
export const LABEL_GAP_METERS = 2;
/** 乗換行に並べる路線カラーチップの上限 */
export const MAX_CHIPS = 4;
export const CHIP_RADIUS = 0.9;
/** チップどうしの間隔 */
export const CHIP_GAP = 0.4;
/** チップ列と乗換テキストの間隔 */
export const CHIP_TEXT_GAP = 0.6;
/** 路線カラー未設定時の既定色（対面乗換帯のフォールバックと揃える） */
export const DEFAULT_LINE_COLOR = '#9ca3af';

const ELLIPSIS = '…';

export type ConcourseLabel = {
  concourseId: string;
  /** 縦ヒゲを下ろすx（座標を持つアクセス点。昇順・重複除去） */
  tickXs: number[];
  /** 束ね線の範囲。tickXs が1件のときは start === end となり横線は引かない */
  bracketStartX: number;
  bracketEndX: number;
  /** ラベルブロックの中心x（viewBox内にクランプ済み） */
  labelX: number;
  /** ラベルブロックの推定幅。段の割り当てと中央寄せに使う */
  labelWidth: number;
  /** 段番号。0 が設備行に最も近い */
  row: number;
  /** 出口名（省略済み）。未入力なら null */
  exitText: string | null;
  /** 乗換先の短縮テキスト（省略済み）。乗換先が無ければ null */
  transferText: string | null;
  /** 乗換行（チップ列＋テキスト）の総幅。乗換先が無ければ0 */
  transferLineWidth: number;
  /** チップ列の幅（末尾のテキストとの間隔を含む）。チップが無ければ0 */
  chipsWidth: number;
  /** 路線カラーチップ。未設定色は既定色に置換済み、MAX_CHIPS 件まで */
  lineColors: string[];
  /** <title> 用の全文。省略していない情報がここに残る */
  title: string;
};

export type ConcourseLayout = {
  /** x昇順 */
  labels: ConcourseLabel[];
  rowCount: number;
};

/**
 * 全角を1em、半角を0.5emとして文字列の描画幅を概算する。
 *
 * SVG は描画前に <text> の実幅を測れないため概算に頼る。誤差は LABEL_GAP_METERS の
 * 余白で吸収する前提であり、厳密な字送りは再現しない。
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) {
    em += isFullWidth(char.codePointAt(0)!) ? 1 : 0.5;
  }
  return em * fontSize;
}

function isFullWidth(codePoint: number): boolean {
  if (codePoint <= 0xff) return false; // ASCII / Latin-1
  if (codePoint >= 0xff61 && codePoint <= 0xffdc) return false; // 半角カナ
  if (codePoint >= 0xffe8 && codePoint <= 0xffee) return false; // 半角記号
  return true;
}

/** maxWidth に収まるよう末尾を「…」で切る。収まるならそのまま返す */
export function truncateToWidth(text: string, fontSize: number, maxWidth: number): string {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;

  const budget = maxWidth - estimateTextWidth(ELLIPSIS, fontSize);
  if (budget <= 0) return ELLIPSIS;

  let width = 0;
  let kept = '';
  for (const char of text) {
    const next = width + estimateTextWidth(char, fontSize);
    if (next > budget) break;
    width = next;
    kept += char;
  }
  return kept + ELLIPSIS;
}

/**
 * 各コンコースの束ね線とラベルの配置を決める（純関数）。
 *
 * 座標を持つアクセス点が1つも無いコンコースは図に描けないため対象外とする
 * （PlatformDisplay 下部のテキストリストに委ねる）。
 */
export function layoutConcourseLabels(
  concourses: ConcourseDTO[],
  bounds: Bounds,
): ConcourseLayout {
  const fontSize = CONCOURSE_LABEL_FONT_SIZE;

  const candidates = concourses
    .map((concourse) => buildLabel(concourse, bounds, fontSize))
    .filter((label): label is Omit<ConcourseLabel, 'row'> => label !== null)
    .sort((a, b) => a.labelX - b.labelX);

  // 段の割り当て（貪欲法）。x昇順に見て、直前のラベルとの間隔が足りる最も内側の段に置く
  const rowRightEdges: number[] = [];
  const labels = candidates.map((label) => {
    const left = label.labelX - label.labelWidth / 2;
    let row = rowRightEdges.findIndex((right) => left - right >= LABEL_GAP_METERS);
    if (row === -1) row = rowRightEdges.length;
    rowRightEdges[row] = label.labelX + label.labelWidth / 2;
    return { ...label, row };
  });

  return { labels, rowCount: rowRightEdges.length };
}

function buildLabel(
  concourse: ConcourseDTO,
  bounds: Bounds,
  fontSize: number,
): Omit<ConcourseLabel, 'row'> | null {
  const tickXs = [
    ...new Set(
      concourse.cells
        .map((cell) => cell.xPositionMeters)
        .filter((x): x is number => x !== null),
    ),
  ].sort((a, b) => a - b);
  if (tickXs.length === 0) return null;

  const exitFull = exitsLabel(concourse);
  const transferFulls = connectionLabels(concourse);
  if (exitFull === null && transferFulls.length === 0) return null;

  const lineColors = concourse.connections
    .flatMap((conn) => conn.lineColors)
    .map((color) => color ?? DEFAULT_LINE_COLOR)
    .slice(0, MAX_CHIPS);
  const chipsWidth =
    lineColors.length > 0
      ? lineColors.length * CHIP_RADIUS * 2 + (lineColors.length - 1) * CHIP_GAP + CHIP_TEXT_GAP
      : 0;

  const exitText =
    exitFull === null ? null : truncateToWidth(exitFull, fontSize, MAX_LABEL_WIDTH_METERS);

  const transferFull = connectionShortLabels(concourse).join('・');
  const transferText =
    transferFull === ''
      ? null
      : truncateToWidth(transferFull, fontSize, MAX_LABEL_WIDTH_METERS - chipsWidth);
  const transferLineWidth =
    transferText === null ? 0 : chipsWidth + estimateTextWidth(transferText, fontSize);

  const labelWidth = Math.max(
    exitText === null ? 0 : estimateTextWidth(exitText, fontSize),
    transferLineWidth,
  );

  const bracketStartX = tickXs[0];
  const bracketEndX = tickXs[tickXs.length - 1];

  return {
    concourseId: concourse.id,
    tickXs,
    bracketStartX,
    bracketEndX,
    labelX: clampLabelX((bracketStartX + bracketEndX) / 2, labelWidth, bounds),
    labelWidth,
    exitText,
    transferText,
    transferLineWidth,
    chipsWidth,
    lineColors: transferText === null ? [] : lineColors,
    title: [exitFull, transferFulls.length > 0 ? `乗換: ${transferFulls.join('・')}` : null]
      .filter(Boolean)
      .join(' / '),
  };
}

/** ラベルが viewBox からはみ出さないよう中心xを寄せる。束ね線自体は動かさない */
function clampLabelX(x: number, labelWidth: number, bounds: Bounds): number {
  const min = bounds.minX + labelWidth / 2;
  const max = bounds.maxX - labelWidth / 2;
  // ラベルが viewBox より広い場合はクランプ範囲が反転するので、中央に置く
  if (min > max) return (bounds.minX + bounds.maxX) / 2;
  return Math.min(Math.max(x, min), max);
}
