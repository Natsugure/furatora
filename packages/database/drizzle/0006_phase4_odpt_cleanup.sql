ALTER TABLE "odpt_metadata" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "odpt_metadata" CASCADE;--> statement-breakpoint
ALTER TABLE "lines" DROP CONSTRAINT "uniqueRailwayPerOperator";--> statement-breakpoint
ALTER TABLE "stations" DROP CONSTRAINT "uniqueStationPerOperator";--> statement-breakpoint
ALTER TABLE "station_connections" DROP CONSTRAINT "station_connections_connected_railway_id_lines_id_fk";
--> statement-breakpoint
ALTER TABLE "station_connections" ALTER COLUMN "connected_station_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "station_connections" DROP COLUMN "connected_railway_id";--> statement-breakpoint
ALTER TABLE "station_connections" DROP COLUMN "odpt_station_id";--> statement-breakpoint
ALTER TABLE "station_connections" DROP COLUMN "odpt_railway_id";