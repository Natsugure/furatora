import type { TrainStopPatternDTO } from '@furatora/platform-diagram/domain';

// 番線に停まる列車の両数を、重複を除いて小さい順に「8・10両編成」とする。列車が無ければ null。
// 番線のカードの頭に出す
export function formationLabel(stopPatterns: Pick<TrainStopPatternDTO, 'carCount'>[]): string | null {
  if (stopPatterns.length === 0) return null;
  const counts = [...new Set(stopPatterns.map((p) => p.carCount))].sort((a, b) => a - b);
  return `${counts.join('・')}両編成`;
}
