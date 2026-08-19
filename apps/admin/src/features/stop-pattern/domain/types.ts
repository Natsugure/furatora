// 停車位置パターン画面用のDTO定義。Drizzle非依存（ADR-0003）。
// decimal → number の変換は external/query/ の中で行い、ここより上には string を渡さない
// （docs/domain/platform-coordinate-system.md「単位と精度」）。

export type StopPatternCarDTO = {
  carNumber: number;
  startMeters: number;
  endMeters: number;
};

export type StopPatternListItemDTO = {
  id: string;
  trainId: string;
  trainName: string;
  cars: StopPatternCarDTO[];
};

export type StopPatternListDTO = {
  stationId: string;
  stationName: string;
  platformId: string;
  platformNumber: string;
  physicalLength: number;
  patterns: StopPatternListItemDTO[];
};

export type TrainOptionCarDTO = {
  carNumber: number;
  carLength: number | null;
};

export type TrainOptionDTO = {
  id: string;
  name: string;
  carCount: number;
  cars: TrainOptionCarDTO[];
};

export type StopPatternEditContextDTO = {
  stationId: string;
  stationName: string;
  platformId: string;
  platformNumber: string;
  physicalLength: number;
  trains: TrainOptionDTO[];
  pattern?: {
    id: string;
    trainId: string;
    cars: StopPatternCarDTO[];
  };
};
