// 停車位置パターン画面用のDTO定義。Drizzle非依存（ADR-0003）。
// decimal → number の変換は external/query/ の中で行い、ここより上には string を渡さない
// （docs/domain/platform-coordinate-system.md「単位と精度」）。

export type TrainOptionCarDTO = {
  carNumber: number;
  carLength: number | null;
  /** 未登録号車は既定値4で補う（stationLayoutPageQueryのgetStopPatternsと同じ既定値） */
  doorCount: number;
};

export type TrainOptionDTO = {
  id: string;
  name: string;
  carCount: number;
  cars: TrainOptionCarDTO[];
};
