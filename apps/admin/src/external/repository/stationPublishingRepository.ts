import { db } from '@furatora/database/client';
import { withTransaction, type Tx } from '@furatora/database/tx';
import { stations, stationLines, lines } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import {
  LineSlugMissingError,
  SlugTakenError,
  type StationPublishingRepository,
} from '@/features/station-publishing/ports';

// PostgreSQL の一意制約違反（unique_violation）。
//
// 【stopPatternRepository.ts の isUniqueViolation とは判定方法が異なる】
// 実測（rehearsalブランチでの検証）で、drizzle-orm 0.45.1 は withTransaction
// 経由の失敗を DrizzleQueryError でラップし、実際の pg エラー（code: '23505'）は
// トップレベルの `err.code` ではなく `err.cause.code` に入ることを確認した。
// `err.code` だけを見る判定は 23505 を検知できず、SlugTakenError に写像されずに
// route.ts の catch を素通りして 500 になる（本来は 409 であるべき）。
// 同種の判定を持つ他の Repository（stopPatternRepository 等）も同じ問題を
// 抱えている可能性があるため、後続で確認する（このPRのスコープ外）。
const UNIQUE_VIOLATION_CODE = '23505';

function getErrorCode(err: unknown): unknown {
  return typeof err === 'object' && err !== null && 'code' in err
    ? (err as { code: unknown }).code
    : undefined;
}

function isUniqueViolation(err: unknown): boolean {
  if (getErrorCode(err) === UNIQUE_VIOLATION_CODE) return true;
  const cause = typeof err === 'object' && err !== null && 'cause' in err
    ? (err as { cause: unknown }).cause
    : undefined;
  return getErrorCode(cause) === UNIQUE_VIOLATION_CODE;
}

// 駅が属する路線の slug を読む。stationLines が複数路線を持つ場合（実測5駅）は
// いずれか1件で判定する。可視性（visibleLine）は「所属路線のいずれかが
// slug を持てば見える」という粒度ではなく apps/web 側で個別に判定されるため、
// ここでの1件判定は「先に路線の slug を求める」導線を出すための簡易チェックに留まる
async function findLineSlug(tx: Tx, stationId: string): Promise<string | null | undefined> {
  const [row] = await tx
    .select({ slug: lines.slug })
    .from(stationLines)
    .innerJoin(lines, eq(lines.id, stationLines.lineId))
    .where(eq(stationLines.stationId, stationId))
    .limit(1);
  return row?.slug;
}

export const dbStationPublishingRepository: StationPublishingRepository = {
  async publish(stationId, slug) {
    try {
      return await withTransaction(async (tx) => {
        const lineSlug = await findLineSlug(tx, stationId);
        if (lineSlug === undefined) return false; // 駅そのものが見つからない、または路線に属していない
        if (!lineSlug) throw new LineSlugMissingError();

        const [updated] = await tx
          .update(stations)
          .set({ slug, publishedAt: new Date(), updatedAt: new Date() })
          .where(eq(stations.id, stationId))
          .returning({ id: stations.id });
        return !!updated;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new SlugTakenError();
      }
      throw err;
    }
  },

  async unpublish(stationId) {
    // slug は消さない（design.md「生成タイミング」。再公開時に同じ URL を維持する）
    const [updated] = await db
      .update(stations)
      .set({ publishedAt: null, updatedAt: new Date() })
      .where(eq(stations.id, stationId))
      .returning({ id: stations.id });
    return !!updated;
  },
};
