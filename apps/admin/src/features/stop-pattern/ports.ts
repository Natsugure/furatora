import type { TrainStopPatternInput } from './schema';

export interface StopPatternRepository {
  save(pattern: TrainStopPatternInput): Promise<void>;
  delete(id: string): Promise<boolean>;
}
