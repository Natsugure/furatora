import { db } from '@furatora/database/client';
import { platforms } from '@furatora/database/schema';
import { eq, and } from 'drizzle-orm';
import type { PlatformRepository, PlatformRecord } from '@/features/platform/ports';

// platforms は子テーブル（旧 platformCarStopPositions）を持たない単一テーブルのため、
// withTransaction は使わず db のままでよい（ADR-0005「単一テーブルの単純な書き込み」）。
export const dbPlatformRepository: PlatformRepository = {
  async create(stationId, input) {
    const [row] = await db
      .insert(platforms)
      .values({
        stationId,
        platformNumber: input.platformNumber,
        lineId: input.lineId,
        inboundDirectionId: input.inboundDirectionId ?? null,
        outboundDirectionId: input.outboundDirectionId ?? null,
        physicalLength: String(input.physicalLength),
        platformSide: input.platformSide ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return row as PlatformRecord;
  },

  async update(id, stationId, input) {
    const [row] = await db
      .update(platforms)
      .set({
        platformNumber: input.platformNumber,
        lineId: input.lineId,
        inboundDirectionId: input.inboundDirectionId ?? null,
        outboundDirectionId: input.outboundDirectionId ?? null,
        physicalLength: String(input.physicalLength),
        platformSide: input.platformSide ?? null,
        notes: input.notes ?? null,
      })
      .where(and(eq(platforms.id, id), eq(platforms.stationId, stationId)))
      .returning();
    return (row as PlatformRecord) ?? null;
  },

  async delete(id, stationId) {
    const [row] = await db
      .delete(platforms)
      .where(and(eq(platforms.id, id), eq(platforms.stationId, stationId)))
      .returning();
    return !!row;
  },
};
