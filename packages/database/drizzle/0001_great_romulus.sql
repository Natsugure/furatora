CREATE TABLE "platform_location_cells" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"platform_location_id" uuid NOT NULL,
	"near_platform_cell" integer
);
--> statement-breakpoint
ALTER TABLE "facility_connections" ADD COLUMN "connected_platform_id" uuid;--> statement-breakpoint
ALTER TABLE "facility_connections" ADD COLUMN "direction_id" uuid;--> statement-breakpoint
ALTER TABLE "station_facilities" ADD COLUMN "platform_location_cell_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_location_cells" ADD CONSTRAINT "platform_location_cells_platform_location_id_platform_locations_id_fk" FOREIGN KEY ("platform_location_id") REFERENCES "public"."platform_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_connections" ADD CONSTRAINT "facility_connections_connected_platform_id_platforms_id_fk" FOREIGN KEY ("connected_platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_connections" ADD CONSTRAINT "facility_connections_direction_id_line_directions_id_fk" FOREIGN KEY ("direction_id") REFERENCES "public"."line_directions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_facilities" ADD CONSTRAINT "station_facilities_platform_location_cell_id_platform_location_cells_id_fk" FOREIGN KEY ("platform_location_cell_id") REFERENCES "public"."platform_location_cells"("id") ON DELETE cascade ON UPDATE no action;
