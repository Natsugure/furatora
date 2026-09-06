import { db } from '@furatora/database/client';
import { lines, operators, stationLines, stations } from '@furatora/database/schema';
import { and, eq, exists, isNotNull, sql } from 'drizzle-orm';

// 可視性はこの1ファイルの述語だけが担う。読み取り経路ごとに条件を書かない。
// かつて可視性は「一覧を組み立てる側」にしか書かれておらず、詳細ページ・公開APIには
// 判定が無かった（URL 直打ちで非公開駅・非公開路線に到達できた）。その再発を防ぐため、
// 全ての読み取り経路がここの述語を where 句で通す。
// 設計と経緯: docs/domain/station-visibility.md「判定は単一の述語を通す」/ ADR-0007（Issue #56）。
//
// `operators.displayPriority` はかつて「NULL = 非表示」の二役を担っていたが、
// マイグレーション 0008 で表示順専用（NOT NULL DEFAULT 0）に純化済みであり、
// 可視性を判定する述語は `stations.publishedAt`（下記）だけである。

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
 * `/lines/null/stations` が生成される
 * （docs/domain/station-visibility.md「判定は単一の述語を通す」の `visibleLine()` の項）。
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
