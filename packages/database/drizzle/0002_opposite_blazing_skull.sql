ALTER TABLE "gtfs_metadata" RENAME TO "odpt_metadata";--> statement-breakpoint
ALTER TABLE "odpt_metadata" RENAME COLUMN "hash" TO "station_hash";--> statement-breakpoint
ALTER TABLE "lines" RENAME COLUMN "gtfs_route_id" TO "odpt_railway_id";--> statement-breakpoint
ALTER TABLE "lines" RENAME COLUMN "long_name" TO "name";--> statement-breakpoint
ALTER TABLE "lines" RENAME COLUMN "operators" TO "operator_id";--> statement-breakpoint
ALTER TABLE "operators" RENAME COLUMN "gtfs_agency_id" TO "odpt_operator_id";--> statement-breakpoint
ALTER TABLE "stations" RENAME COLUMN "gtfs_stop_id" TO "odpt_station_id";--> statement-breakpoint
ALTER TABLE "stations" RENAME COLUMN "operators" TO "operator_id";--> statement-breakpoint
ALTER TABLE "odpt_metadata" DROP CONSTRAINT "gtfs_metadata_operator_unique";--> statement-breakpoint
ALTER TABLE "lines" DROP CONSTRAINT "uniqueRoutePerOperator";--> statement-breakpoint
ALTER TABLE "stations" DROP CONSTRAINT "uniqueStopPerOperator";--> statement-breakpoint
ALTER TABLE "lines" DROP CONSTRAINT "lines_operators_operators_id_fk";
--> statement-breakpoint
ALTER TABLE "stations" DROP CONSTRAINT "stations_operators_operators_id_fk";
--> statement-breakpoint
ALTER TABLE "lines" ALTER COLUMN "color" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "odpt_metadata" ADD COLUMN "railway_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "lines" ADD COLUMN "line_code" varchar(10);--> statement-breakpoint
ALTER TABLE "lines" ADD COLUMN "name_en" varchar(100);--> statement-breakpoint
ALTER TABLE "lines" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "station_lines" ADD COLUMN "station_order" integer;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "name_en" varchar(100);--> statement-breakpoint
ALTER TABLE "trains" ADD COLUMN "car_count" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "trains" ADD COLUMN "priority_seats" jsonb;--> statement-breakpoint
ALTER TABLE "lines" ADD CONSTRAINT "lines_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lines" DROP COLUMN "short_name";--> statement-breakpoint
ALTER TABLE "stations" DROP COLUMN "wheelchair_boarding";--> statement-breakpoint
ALTER TABLE "odpt_metadata" ADD CONSTRAINT "odpt_metadata_operator_unique" UNIQUE("operator");--> statement-breakpoint
ALTER TABLE "lines" ADD CONSTRAINT "uniqueRailwayPerOperator" UNIQUE("odpt_railway_id","operator_id");--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "uniqueStationPerOperator" UNIQUE("odpt_station_id","operator_id");