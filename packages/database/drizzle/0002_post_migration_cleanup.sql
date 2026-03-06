ALTER TABLE "station_facilities" ALTER COLUMN "platform_location_cell_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "station_facilities" DROP CONSTRAINT "station_facilities_platform_location_id_platform_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "station_facilities" DROP COLUMN "platform_location_id";
--> statement-breakpoint
ALTER TABLE "platform_locations" DROP COLUMN "near_platform_cell";
