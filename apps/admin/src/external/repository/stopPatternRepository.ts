import { db } from '@furatora/database/client';
import { withTransaction } from '@furatora/database/tx';
import { trainStopPatterns, trainStopPatternCars } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import type { StopPatternRepository } from '@/features/stop-pattern/ports';

// trainStopPatterns.id は DB側で採番されるため「親を insert → 返却された id で子を insert」
// という順序が必須。この形は db.batch() では表現できないため withTransaction を使う（ADR-0005）。
export const dbStopPatternRepository: StopPatternRepository = {
  async save(pattern) {
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
  },

  async delete(id) {
    // trainStopPatternCars は CASCADE で削除される
    const [row] = await db.delete(trainStopPatterns).where(eq(trainStopPatterns.id, id)).returning();
    return !!row;
  },
};
