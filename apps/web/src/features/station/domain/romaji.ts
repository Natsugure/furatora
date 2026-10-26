/**
 * ローマ字表記の区切り記号（ハイフンと空白）を取り除く関数
 * @param s - ローマ字表記の文字列
 * @returns 区切り記号を取り除いた文字列
 */
export function stripRomajiSeparator(s: string): string {
  return s.replace(/[-\s]/g, '');
}