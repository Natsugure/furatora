import type { ConcourseDTO } from './types';

/**
 * 「設備・乗換情報」に出せる情報を持つコンコースか。
 * 設備が1件も無くても、出口名や乗換先だけで利用者にとって意味のある情報になる。
 */
export function hasDisplayableInfo(concourse: Pick<ConcourseDTO, 'cells' | 'exits' | 'connections'>): boolean {
  return concourse.cells.length > 0 || exitsLabel(concourse) !== null || concourse.connections.length > 0;
}

/** 出口名。空文字・空白のみは未入力として扱う */
export function exitsLabel(concourse: Pick<ConcourseDTO, 'exits'>): string | null {
  return concourse.exits?.trim() || null;
}

/** 乗換先の表示ラベル。接続1件につき1要素を返す */
export function connectionLabels(concourse: Pick<ConcourseDTO, 'connections'>): string[] {
  return concourse.connections.map((conn) => {
    // 路線が引けない接続でも空文字にならないよう駅名で代替する
    const lineLabel = conn.lineNames.length > 0 ? conn.lineNames.join('・') : conn.stationName;
    const base = conn.directionName ? `${lineLabel}（${conn.directionName}方面）` : lineLabel;
    // exitLabel は管理画面では「備考（任意）」の自由入力。内容を解釈せずそのまま添える
    return conn.exitLabel ? `${base}［${conn.exitLabel}］` : base;
  });
}

/** 短縮ラベルで路線名をそのまま並べる上限。これを超えると「先頭路線ほかN」に畳む */
const SHORT_LABEL_LINE_LIMIT = 2;

/**
 * 乗換先の短縮ラベル。SVG図内のラベル用で、接続1件につき1要素を返す。
 *
 * lineNames には「接続先駅に乗り入れる全路線」が入る（external/query/stationDetailQuery.ts）。
 * 新宿・渋谷級では6路線以上になり connectionLabels() の出力は図に収まらないため、
 * 3路線以上は先頭1件に畳む。方面名・備考も落とす（全文は connectionLabels() 側にある）。
 */
export function connectionShortLabels(concourse: Pick<ConcourseDTO, 'connections'>): string[] {
  return concourse.connections.map((conn) => {
    // 路線が引けない接続でも空文字にならないよう駅名で代替する（connectionLabels と同じ）
    if (conn.lineNames.length === 0) return conn.stationName;
    if (conn.lineNames.length <= SHORT_LABEL_LINE_LIMIT) return conn.lineNames.join('・');
    return `${conn.lineNames[0]}ほか${conn.lineNames.length - 1}`;
  });
}
