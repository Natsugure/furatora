import { db } from '@furatora/database/client';
import { withTransaction } from '@furatora/database/tx';
import { trainStopPatterns, trainStopPatternCars } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { DuplicateStopPatternError, type StopPatternRepository } from '@/features/stop-pattern/ports';

// PostgreSQL の一意制約違反（unique_violation）のエラーコード。
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION_CODE = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

// trainStopPatterns.id は DB側で採番されるため「親を insert → 返却された id で子を insert」
// という順序が必須。この形は db.batch() では表現できないため withTransaction を使う（ADR-0005）。
export const dbStopPatternRepository: StopPatternRepository = {
  async save(pattern) {
    try {
      await withTransaction(async (tx) => {
        const [row] = await tx
          .insert(trainStopPatterns)
          .values({ platformId: pattern.platformId, trainId: pattern.trainId })
          .returning();
        await tx.insert(trainStopPatternCars).values(
          pattern.cars.map((c) => ({
            trainStopPatternId: row.id,
            carNumber: c.carNumber,
            startMeters: String(c.startMeters),
            endMeters: String(c.endMeters),
          }))
        );
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DuplicateStopPatternError(
          'このホーム・列車の組み合わせには既に停車位置パターンが登録されています'
        );
      }
      throw err;
    }
  },

  async update(id, pattern) {
    try {
      return await withTransaction(async (tx) => {
        const [updated] = await tx
          .update(trainStopPatterns)
          .set({ platformId: pattern.platformId, trainId: pattern.trainId })
          .where(eq(trainStopPatterns.id, id))
          .returning();
        if (!updated) return false;

        // cars は delete → insert で置き換える（親IDは変わらないため batch でも表現できるが、
        // save() と実装を揃えるため withTransaction 内に統一する）
        await tx.delete(trainStopPatternCars).where(eq(trainStopPatternCars.trainStopPatternId, id));
        await tx.insert(trainStopPatternCars).values(
          pattern.cars.map((c) => ({
            trainStopPatternId: id,
            carNumber: c.carNumber,
            startMeters: String(c.startMeters),
            endMeters: String(c.endMeters),
          }))
        );
        return true;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DuplicateStopPatternError(
          'このホーム・列車の組み合わせには既に停車位置パターンが登録されています'
        );
      }
      throw err;
    }
  },

  async delete(id) {
    // trainStopPatternCars は CASCADE で削除される
    const [row] = await db.delete(trainStopPatterns).where(eq(trainStopPatterns.id, id)).returning();
    return !!row;
  },
};
