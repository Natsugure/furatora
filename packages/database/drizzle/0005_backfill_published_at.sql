-- TASK-3.7: 既存駅の published_at バックフィル（Issue #56 / docs/spec/design.md）
--
-- 【なぜスキーマ差分ではなく手書きのデータ移行なのか】
-- stations.published_at は 0004 で追加され、全行 NULL = 非公開である。
-- 可視性が operators.display_priority から stations.published_at へ移るため、
-- これを埋めないまま Phase 5 を出すと公開サイトが空になる。
-- Vercel のビルドがマイグレーションを流すので、この文を置くことで
-- development / preview / production のすべてが同じ手順で移行される。
--
-- 【display_priority IS NOT NULL を落とさないこと】
-- 移行前の可視性をそのまま引き継ぐための条件である。現行の apps/web は
-- 「display_priority が NULL の事業者は表示しない」で可視性を判定している。
-- この条件を外すと、移行前に非表示だった事業者（ゆりかもめ等）の駅まで公開され、
-- requirements.md US-7 の実バグを仕様として恒久化することになる。
--
-- 【ekidata の駅が入る前に走ること】
-- 対象は ODPT 由来の既存行だけである。インポート（Admin の /master-import）は
-- デプロイ後の手動操作であり、そこで入る全国の駅は published_at = NULL のまま、
-- 管理者が個別に公開する。
--
-- 【published_requires_slug には触れない】
-- 0004 の CHECK は「公開するなら slug が必要」である。既存行の slug は
-- 全件生成済み（NULL 0件 / 481行）であることを確認済みのため違反は出ない。
--
-- 実行前の実測（2026-09-04）: main は 335行が公開・146行が NULL のまま。
-- development は JR東日本の display_priority が入っているため 438行になる。
-- 環境ごとに件数が違うのは、この文が各環境の「移行前の可視性」を写すためであり正しい。
UPDATE "stations" SET "published_at" = now()
FROM "operators"
WHERE "stations"."operator_id" = "operators"."id"
  AND "stations"."published_at" IS NULL
  AND "operators"."display_priority" IS NOT NULL;
