import type { TrainStopPatternInput } from './schema';

// 一意制約（platformId, trainId）違反を、route.ts が 409 に写像するためのドメインエラー。
// Drizzle/Next.js 非依存（ADR-0002）。実装は external/repository/stopPatternRepository.ts。
export class DuplicateStopPatternError extends Error {}

/**
 * 書き込み: Repository（ADR-0003）。集約単位で不変条件を守って永続化する。
 *
 * trainStopPatterns は stationId を持たず platformId 経由でしか駅に紐づかないため、
 * 全メソッドが stationId を受け取り、対象（および付け替え先）のホームが当該駅の
 * ものであることを実装側で保証する。save の戻り値 null・update/delete の false は
 * 「当該駅に該当ホームが無い」の意味で、route.ts が404に写像する。
 * save は作成したパターンの id を返す（新規作成直後の編集継続に使用）。
 */
export interface StopPatternRepository {
  save(stationId: string, pattern: TrainStopPatternInput): Promise<{ id: string } | null>;
  update(id: string, stationId: string, pattern: TrainStopPatternInput): Promise<boolean>;
  delete(id: string, stationId: string): Promise<boolean>;
}
