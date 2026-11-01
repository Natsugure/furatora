ALTER TABLE "lines" DROP COLUMN "abolished_at";--> statement-breakpoint
ALTER TABLE "stations" DROP COLUMN "abolished_at";--> statement-breakpoint
ALTER TABLE "station_facilities" DROP COLUMN "is_wheelchair_accessible";--> statement-breakpoint
ALTER TABLE "station_facilities" DROP COLUMN "is_stroller_accessible";--> statement-breakpoint
ALTER TABLE "station_facilities" DROP COLUMN "notes";