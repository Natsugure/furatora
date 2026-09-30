-- station_connections の乗換難易度の旧4列を削除する（Issue #136。二段階マイグレーションの2段目）
-- 読み書きするコードは #124（Admin）・#125（Web）で無くなり、#125 は本番リリース済み。
-- 値は #123 で新モデルへ移行済みで、移行前の値は 0012 の SQL に残る
ALTER TABLE "station_connections" DROP COLUMN "stroller_difficulty";--> statement-breakpoint
ALTER TABLE "station_connections" DROP COLUMN "wheelchair_difficulty";--> statement-breakpoint
ALTER TABLE "station_connections" DROP COLUMN "notes_about_stroller";--> statement-breakpoint
ALTER TABLE "station_connections" DROP COLUMN "notes_about_wheelchair";