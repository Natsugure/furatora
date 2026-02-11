CREATE TABLE "facility_types" (
	"code" varchar(20) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_directions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"line_id" uuid NOT NULL,
	"direction_type" varchar(20) NOT NULL,
	"representative_station_id" uuid NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"display_name_en" varchar(100),
	"terminal_station_ids" uuid[],
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"station_id" uuid NOT NULL,
	"platform_number" varchar(10) NOT NULL,
	"line_id" uuid NOT NULL,
	"inbound_direction_id" uuid,
	"outbound_direction_id" uuid,
	"max_car_count" integer NOT NULL,
	"car_stop_positions" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "station_connections" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"station_id" uuid NOT NULL,
	"connected_station_id" uuid,
	"connected_railway_id" uuid,
	"odpt_station_id" varchar(100),
	"odpt_railway_id" varchar(100),
	"is_wheelchair_accessible" boolean DEFAULT true,
	"is_stroller_accessible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "station_facilities" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"platform_id" uuid NOT NULL,
	"type_code" varchar NOT NULL,
	"near_car_number" integer,
	"description" text,
	"is_wheelchair_accessible" boolean DEFAULT true,
	"is_stroller_accessible" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "station_accessibility" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "station_accessibility" CASCADE;--> statement-breakpoint
ALTER TABLE "operators" ADD COLUMN "display_priority" integer;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "slug" varchar(100);--> statement-breakpoint
ALTER TABLE "line_directions" ADD CONSTRAINT "line_directions_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_directions" ADD CONSTRAINT "line_directions_representative_station_id_stations_id_fk" FOREIGN KEY ("representative_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_inbound_direction_id_line_directions_id_fk" FOREIGN KEY ("inbound_direction_id") REFERENCES "public"."line_directions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_outbound_direction_id_line_directions_id_fk" FOREIGN KEY ("outbound_direction_id") REFERENCES "public"."line_directions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_connections" ADD CONSTRAINT "station_connections_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_connections" ADD CONSTRAINT "station_connections_connected_station_id_stations_id_fk" FOREIGN KEY ("connected_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_connections" ADD CONSTRAINT "station_connections_connected_railway_id_lines_id_fk" FOREIGN KEY ("connected_railway_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_facilities" ADD CONSTRAINT "station_facilities_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_facilities" ADD CONSTRAINT "station_facilities_type_code_facility_types_code_fk" FOREIGN KEY ("type_code") REFERENCES "public"."facility_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_slug_unique" UNIQUE("slug");