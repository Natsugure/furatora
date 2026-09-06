import { db } from '@furatora/database/client';
import { lines, operators, stationLines, stations } from '@furatora/database/schema';
import { and, eq, exists, isNotNull, sql } from 'drizzle-orm';

// TASK-5.0（Issue #56 / docs/spec/design.md「現行の可視性ガードは一覧にしか無い」）。
//
// 可視性はこの1ファイルの述語だけが担う。読み取り経路ごとに条件を書かない（REQ-7.5）。
// 現行 apps/web の `isNotNull(operators.displayPriority)` は「一覧を組み立てる側」に
// しか書かれておらず、詳細ページ・6つの公開APIには可視性の判定が無かった
// （実証済み: /stations/yurikamome-yurikamome-shiodome、
//  /lines/yurikamome-yurikamome/stations）。
//
// `operators.displayPriority` は表示順専用に純化される（Phase 5b, TASK-5b.1）。
// 移行後、可視性を判定する述語はここだけになる。

/** 駅が見えるのは publishedAt が設定されているときだけ */
export function publishedStation() {
  return isNotNull(stations.publishedAt);
}

/**
 * 路線が見えるのは「slug を持ち、かつ公開駅を1件以上持つ」とき。
 *
 * slug を条件に含めるのは `LineAccordion.tsx` が
 * `/lines/${line.slug}/stations` へフォールバック無しでリンクしているため。
 * ekidata 由来の路線は slug が NULL で入るため、対策しなければ
 * `/lines/null/stations` が生成される（design.md「lines.slug の欠落は駅より先に踏む」）。
 *
 * 「公開駅を持つ路線は必ず slug を持つ」という不変条件を立てて守る方針は採らない。
 * 不変条件を守るのではなく、不要にする。`LineAccordion` 側にガードは足さない。
 */
export function visibleLine() {
  return and(
    isNotNull(lines.slug),
    exists(
      db
        .select({ one: sql`1` })
        .from(stationLines)
        .innerJoin(stations, eq(stations.id, stationLines.stationId))
        .where(and(eq(stationLines.lineId, lines.id), publishedStation())),
    ),
  );
}

/** 事業者が見えるのは公開駅を1件以上持つとき。lines / operators に公開フラグは追加しない（YAGNI） */
export function visibleOperator() {
  return exists(
    db
      .select({ one: sql`1` })
      .from(stations)
      .where(and(eq(stations.operatorId, operators.id), publishedStation())),
  );
}
