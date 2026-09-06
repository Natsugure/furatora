-- operators.display_priority を表示順専用に純化する
-- （Issue #56 / ADR-0007 / docs/domain/station-visibility.md）
--
-- 【背景】この列はかつて「数字=表示順 / NULL=非表示」の二役を担っていた。
-- 可視性の判定は 0005 のバックフィルと TASK-5.0（可視性述語を stations.published_at へ
-- 一元化）で stations.published_at へ完全に移り、apps/web から display_priority を
-- 読むコードは消えている。この 0008 で可視性の意味を構造からも外す。
--
-- 【NOT NULL 化の前に NULL を 0 で埋めること】
-- drizzle-kit が生成するのは下の SET DEFAULT / SET NOT NULL の2文だけである。
-- 本番（Neon main）には display_priority が NULL の事業者が 160 行あり、
-- この UPDATE を先に置かないと SET NOT NULL が 23502 で失敗し、
-- Vercel のビルド（＝マイグレーション実行。ADR-0008）ごと落ちる。
--
-- 【TASK-5.0 のデプロイ後に、単独 PR で適用すること】
-- マイグレーションはビルド時に走るため、TASK-5.0 と同居させると
-- 「display_priority で判定する古いコード」が「全行 0 の DB」を見る窓が生じ、
-- 非表示事業者の駅が一時的に露出する。本 PR は Phase 6 とも分離している。
--> statement-breakpoint
UPDATE "operators" SET "display_priority" = 0 WHERE "display_priority" IS NULL;--> statement-breakpoint
ALTER TABLE "operators" ALTER COLUMN "display_priority" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "operators" ALTER COLUMN "display_priority" SET NOT NULL;
