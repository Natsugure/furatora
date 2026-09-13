import type { TrainStopPatternInput } from './schema';
import type { StopPatternListDTO, StopPatternEditContextDTO } from './domain/types';

// 一意制約（platformId, trainId）違反を、route.ts が 409 に写像するためのドメインエラー。
// Drizzle/Next.js 非依存（ADR-0002）。実装は external/repository/stopPatternRepository.ts。
export class DuplicateStopPatternError extends Error {}

// 書き込み: Repository（ADR-0003）。集約単位で不変条件を守って永続化する。
//
// trainStopPatterns は stationId を持たず platformId 経由でしか駅に紐づかないため、
// 駅スコープは呼び出し側では守れない。全メソッドが stationId を受け取り、
// 対象（および付け替え先）のホームが当該駅のものであることを実装側で保証する。
// save の戻り値 null は「当該駅に該当ホームが無い」、update/delete の false も同義で
// route.ts が404に写像する。
// save は作成したパターンの id を返す（PR4: 新規作成直後にドラッグ・保存を続けるため
// StationLayoutEditor がこのidを baseline に反映する必要がある。以前は boolean のみで
// POSTのレスポンスにidが含まれず、新規パターンの以後の編集・保存対象を特定できなかった）
export interface StopPatternRepository {
  save(stationId: string, pattern: TrainStopPatternInput): Promise<{ id: string } | null>;
  update(id: string, stationId: string, pattern: TrainStopPatternInput): Promise<boolean>;
  delete(id: string, stationId: string): Promise<boolean>;
}

// 読み取り: Query Service（ADR-0003）。画面単位でDTOを返す。
// admin 全体の Query Service 化は後続Issue（#48）だが、
// 本 feature の新規ページは ESLint の依存ルールにより src/app/** から
// @furatora/database を直接 import できないため、この2画面分のみ先行して導入する。
export interface StopPatternPageQuery {
  getListByPlatform(stationId: string, platformId: string): Promise<StopPatternListDTO | null>;
  getEditContext(
    stationId: string,
    platformId: string,
    patternId?: string,
  ): Promise<StopPatternEditContextDTO | null>;
}
