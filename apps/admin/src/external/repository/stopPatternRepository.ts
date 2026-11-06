import { db } from '@furatora/database/client';
import { withTransaction } from '@furatora/database/tx';
import { trainStopPatterns } from '@furatora/database/schema';
import { and, eq } from 'drizzle-orm';
import { DuplicateStopPatternError, type StopPatternRepository } from '@/features/stop-pattern/ports';
import { requireInserted } from '@/external/requireInserted';
import { isPlatformOfStation, belongsToStation } from '@/external/repository/stationScopeGuard';
import { isPgErrorCode, pgConstraintName, PG_UNIQUE_VIOLATION } from '@/external/pgError';
import type { TrainStopPatternInput } from '@/features/stop-pattern/schema';

// (platformId, trainId) の一意制約違反（23505）だけを DuplicateStopPatternError に写像し、
// route.ts が 409 を返す。ほかの制約の 23505 は組み合わせの重複ではないため写像せず投げ直す。
// ラップされた cause 展開の詳細は external/pgError.ts を見る。
const PATTERN_CONSTRAINT = 'unique_train_stop_pattern';

function toDuplicateStopPatternError(err: unknown): unknown {
  if (isPgErrorCode(err, PG_UNIQUE_VIOLATION) && pgConstraintName(err) === PATTERN_CONSTRAINT) {
    return new DuplicateStopPatternError(
      'このホーム・列車の組み合わせには既に停車位置パターンが登録されています'
    );
  }
  return err;
}

// 停車位置は「1号車の外側の端」と「号車番号の向き」だけを書く。号車の区間は保存せず、
// 読むたびに号車構成から算出する（ADR-0025）。
// 1文で書けるが、ホームが当該駅のものかの確認と同じトランザクションに入れるため withTransaction を使う
// （確認と書き込みの間にホームが付け替わらないようにする。ADR-0005）。
function patternValues(pattern: TrainStopPatternInput) {
  return {
    platformId: pattern.platformId,
    trainId: pattern.trainId,
    // decimal 列は文字列で書く（#165 で mode: 'number' にするまで）
    carOneOuterMeters: String(pattern.carOneOuterMeters),
    carNumbersAscendToward: pattern.carNumbersAscendToward,
  };
}

export const dbStopPatternRepository: StopPatternRepository = {
  async save(stationId, pattern) {
    try {
      return await withTransaction(async (tx) => {
        if (!(await isPlatformOfStation(tx, pattern.platformId, stationId))) return null;

        const row = requireInserted(
          await tx.insert(trainStopPatterns).values(patternValues(pattern)).returning({ id: trainStopPatterns.id })
        );
        return { id: row.id };
      });
    } catch (err) {
      throw toDuplicateStopPatternError(err);
    }
  },

  async update(id, stationId, pattern) {
    try {
      return await withTransaction(async (tx) => {
        // 付け替え先ホームが他駅のものであれば、更新対象が当該駅のものでも拒否する
        if (!(await isPlatformOfStation(tx, pattern.platformId, stationId))) return false;

        const [updated] = await tx
          .update(trainStopPatterns)
          .set(patternValues(pattern))
          .where(and(eq(trainStopPatterns.id, id), belongsToStation(trainStopPatterns.platformId, stationId)))
          .returning({ id: trainStopPatterns.id });
        return !!updated;
      });
    } catch (err) {
      throw toDuplicateStopPatternError(err);
    }
  },

  async delete(id, stationId) {
    const [row] = await db
      .delete(trainStopPatterns)
      .where(and(eq(trainStopPatterns.id, id), belongsToStation(trainStopPatterns.platformId, stationId)))
      .returning();
    return !!row;
  },
};
