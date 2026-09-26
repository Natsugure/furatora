-- ルートの設備を「直列の並び」から「種類の集合」に変える（Issue #123 / ADR-0011）
-- 0009 由来の表で全環境0行、seq を読み書きするコードも無いため、この DROP は非破壊である
ALTER TABLE "transfer_route_facilities" DROP CONSTRAINT "unique_transfer_route_facility_seq";--> statement-breakpoint
ALTER TABLE "transfer_route_facilities" DROP COLUMN "seq";--> statement-breakpoint
ALTER TABLE "transfer_route_facilities" ADD CONSTRAINT "unique_transfer_route_facility_type" UNIQUE("route_id","type_code");
