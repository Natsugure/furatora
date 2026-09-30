ALTER TABLE "line_directions" DROP CONSTRAINT "line_directions_representative_station_id_stations_id_fk";
--> statement-breakpoint
ALTER TABLE "line_directions" DROP COLUMN "representative_station_id";--> statement-breakpoint
ALTER TABLE "line_directions" DROP COLUMN "terminal_station_ids";