-- 既存駅の published_at バックフィル（Issue #56 / ADR-0007 / docs/domain/station-visibility.md）
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
-- 「URL 直打ちで非表示事業者の駅が見える」実バグ（Issue #56）を仕様として恒久化することになる。
--
-- 【ekidata の駅が入る前に走ること】
-- 対象は ODPT 由来の既存行だけである。インポート（Admin の /master-import）は
-- デプロイ後の手動操作であり、そこで入る全国の駅は published_at = NULL のまま、
-- 管理者が個別に公開する。
--
-- 【slug IS NOT NULL を条件に入れる】
-- 0004 の CHECK は「公開するなら slug が必要」である。main の既存481行は
-- slug 生成済み（NULL 0件）を確認済みだが、その事実は実測にすぎない。
-- development / preview は行構成が違い、slug 未生成の行が混ざれば
-- この UPDATE が CHECK 違反で失敗し、Vercel のビルド（= マイグレーション）ごと落ちる。
-- 実測に頼らず、SQL 自身が公開対象を「slug を持つ行」に限定する。
-- slug が無い駅は公開されないまま残り、管理者が slug を付けてから個別に公開する。
--
-- 実行前の実測（2026-09-04）: main は 335行が公開・146行が NULL のまま。
-- development は JR東日本の display_priority が入っているため 438行になる。
-- 環境ごとに件数が違うのは、この文が各環境の「移行前の可視性」を写すためであり正しい。
UPDATE "stations" SET "published_at" = now()
FROM "operators"
WHERE "stations"."operator_id" = "operators"."id"
  AND "stations"."published_at" IS NULL
  AND "stations"."slug" IS NOT NULL
  AND "operators"."display_priority" IS NOT NULL;
