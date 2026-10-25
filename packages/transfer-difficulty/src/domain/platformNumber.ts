/**
 * ホーム番号を数値として比べる（'2' → '10'）。ホーム番号は varchar なので、SQL や文字列の並びでは '10' が '2' より前になる。
 * 駅ページのホームの表示順と方面ラベルを連結する順（docs/domain/line-directions.md）は同じ順でなければならないため、比較はここだけに置く。
 */
export function comparePlatformNumber(a: string, b: string): number {
  return a.localeCompare(b, 'ja', { numeric: true });
}
