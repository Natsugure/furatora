import { db } from '@furatora/database/client';
import type { Tx } from '@furatora/database/tx';
import { platforms } from '@furatora/database/schema';
import { and, eq, exists, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * platformId が stationId のホームに属するか検証する。
 * 省くとA駅の管理画面からB駅のホームに書き込み・付け替えできてしまう。
 */
export async function isPlatformOfStation(tx: Tx, platformId: string, stationId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: platforms.id })
    .from(platforms)
    .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)));
  return !!row;
}

/**
 * platformIdColumn 経由で当該駅のホームに属する行へ絞り込む相関サブクエリ。
 * 「先に SELECT で確認してから UPDATE」ではなく WHERE 句に含めることで、単一文で完結させる。
 */
export function belongsToStation(platformIdColumn: AnyPgColumn, stationId: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(platforms)
      .where(and(eq(platforms.id, platformIdColumn), eq(platforms.stationId, stationId))),
  );
}
