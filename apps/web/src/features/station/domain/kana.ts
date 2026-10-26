export function toKatakana(s: string): string {
  return s.normalize('NFKC').replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
/**
 * 駅名カナ（stations.nameKana）と比較するための検索キーを作る関数
 * @param s - 利用者の入力
 * @returns カタカナにそろえ、空白をすべて取り除いた文字列。
 *   DB 側も同じく空白を取り除いて比較する（name_kana は副駅名の区切りに全角空白を持つ）
 */
export function toKanaSearchKey(s: string): string {
  return toKatakana(s).replace(/\s/g, '');
}
