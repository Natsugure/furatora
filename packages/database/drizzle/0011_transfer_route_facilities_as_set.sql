-- ルートの設備を「直列の並び」から「種類の集合」に変える（Issue #123 / docs/adr/0011-transfer-route-facilities-as-set.md）
--
-- 【なぜ順序を持たないのか】ペルソナごとの「必要な行為」は、ルート上の設備すべてから
-- 最も重いものを選んで導出する。この導出は順序に依存しない。順序を使う要件は
-- 「並びを保持する」「並びと4フラグの一致で重複を検出する」の2点だけで、どちらも集合で足りる。
-- 順序を持つと、入力時に連番の欠番・並べ替えを扱う必要があり、旧データから設備の並びを
-- 復元できない移行（#123）でも確定できない情報を要求してしまう。
--
-- 【なぜ非破壊とみなせるのか】transfer_route_facilities は 0009（#122）で作られた新しい表で、
-- 全環境で0行であり、seq を読み書きするコードは存在しない（CLAUDE.md の二段階規則の
-- 「その列を読むコードが稼働したまま」に当たらない）。また 0009 は production に未適用である
-- （main へのリリース前）。適用済みの 0009 は書き換えず、この新しいマイグレーションで変更する。
--
-- 【unique (route_id, type_code)】同じ種類は1行。行が0件の表なので、追加で失敗することはない。
ALTER TABLE "transfer_route_facilities" DROP CONSTRAINT "unique_transfer_route_facility_seq";--> statement-breakpoint
ALTER TABLE "transfer_route_facilities" DROP COLUMN "seq";--> statement-breakpoint
ALTER TABLE "transfer_route_facilities" ADD CONSTRAINT "unique_transfer_route_facility_type" UNIQUE("route_id","type_code");
