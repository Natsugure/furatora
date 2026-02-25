CREATE EXTENSION IF NOT EXISTS pg_uuidv7;
--> statement-breakpoint
CREATE TABLE "facility_connections" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"platform_location_id" uuid NOT NULL,
	"connected_station_id" uuid NOT NULL,
	"exit_label" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_facility_connection" UNIQUE("platform_location_id","connected_station_id")
);
--> statement-breakpoint
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
CREATE TABLE "lines" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"odpt_railway_id" varchar(100),
	"slug" varchar(100),
	"line_code" varchar(10),
	"name" varchar(100) NOT NULL,
	"name_kana" varchar(100),
	"name_en" varchar(100),
	"color" varchar(7),
	"display_order" integer DEFAULT 0,
	"operator_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lines_slug_unique" UNIQUE("slug"),
	CONSTRAINT "uniqueRailwayPerOperator" UNIQUE("odpt_railway_id","operator_id")
);
--> statement-breakpoint
CREATE TABLE "odpt_metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"operator" varchar(50) NOT NULL,
	"railway_hash" varchar(64),
	"station_hash" varchar(64),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "odpt_metadata_operator_unique" UNIQUE("operator")
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" varchar(100) NOT NULL,
	"odpt_operator_id" varchar(100),
	"display_priority" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "operators_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "platform_car_stop_positions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"platform_id" uuid NOT NULL,
	"car_count" integer NOT NULL,
	"reference_car_number" integer NOT NULL,
	"reference_platform_cell" integer NOT NULL,
	"direction" varchar(20) NOT NULL,
	CONSTRAINT "unique_platform_car_stop" UNIQUE("platform_id","car_count")
);
--> statement-breakpoint
CREATE TABLE "platform_locations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"platform_id" uuid NOT NULL,
	"near_platform_cell" integer,
	"exits" text,
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
	"platform_side" varchar(10),
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
	"stroller_difficulty" varchar(20),
	"wheelchair_difficulty" varchar(20),
	"notes_about_stroller" text,
	"notes_about_wheelchair" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "station_facilities" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"platform_location_id" uuid NOT NULL,
	"type_code" varchar NOT NULL,
	"is_wheelchair_accessible" boolean DEFAULT true,
	"is_stroller_accessible" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "station_lines" (
	"station_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"station_order" integer,
	CONSTRAINT "station_lines_station_id_line_id_pk" PRIMARY KEY("station_id","line_id")
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"odpt_station_id" varchar(100),
	"slug" varchar(100),
	"code" varchar(20),
	"name" varchar(100) NOT NULL,
	"name_kana" varchar(100),
	"name_en" varchar(100),
	"lat" numeric(9, 6),
	"lon" numeric(9, 6),
	"operator_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "uniqueStationPerOperator" UNIQUE("odpt_station_id","operator_id")
);
--> statement-breakpoint
CREATE TABLE "train_car_structures" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"train_id" uuid NOT NULL,
	"car_number" integer NOT NULL,
	"door_count" integer NOT NULL,
	CONSTRAINT "unique_train_car_structure" UNIQUE("train_id","car_number")
);
--> statement-breakpoint
CREATE TABLE "train_equipments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"train_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"car_number" integer NOT NULL,
	"near_door" integer NOT NULL,
	"is_standard" boolean DEFAULT true NOT NULL,
	CONSTRAINT "unique_train_equipment" UNIQUE("train_id","type","car_number","near_door")
);
--> statement-breakpoint
CREATE TABLE "trains" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" varchar(100) NOT NULL,
	"operators" uuid NOT NULL,
	"lines" uuid[] NOT NULL,
	"car_count" integer NOT NULL,
	"limited_to_platform_ids" uuid[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "facility_connections" ADD CONSTRAINT "facility_connections_platform_location_id_platform_locations_id_fk" FOREIGN KEY ("platform_location_id") REFERENCES "public"."platform_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_connections" ADD CONSTRAINT "facility_connections_connected_station_id_stations_id_fk" FOREIGN KEY ("connected_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_directions" ADD CONSTRAINT "line_directions_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_directions" ADD CONSTRAINT "line_directions_representative_station_id_stations_id_fk" FOREIGN KEY ("representative_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lines" ADD CONSTRAINT "lines_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_car_stop_positions" ADD CONSTRAINT "platform_car_stop_positions_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_locations" ADD CONSTRAINT "platform_locations_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_inbound_direction_id_line_directions_id_fk" FOREIGN KEY ("inbound_direction_id") REFERENCES "public"."line_directions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_outbound_direction_id_line_directions_id_fk" FOREIGN KEY ("outbound_direction_id") REFERENCES "public"."line_directions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_connections" ADD CONSTRAINT "station_connections_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_connections" ADD CONSTRAINT "station_connections_connected_station_id_stations_id_fk" FOREIGN KEY ("connected_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_connections" ADD CONSTRAINT "station_connections_connected_railway_id_lines_id_fk" FOREIGN KEY ("connected_railway_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_facilities" ADD CONSTRAINT "station_facilities_platform_location_id_platform_locations_id_fk" FOREIGN KEY ("platform_location_id") REFERENCES "public"."platform_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_facilities" ADD CONSTRAINT "station_facilities_type_code_facility_types_code_fk" FOREIGN KEY ("type_code") REFERENCES "public"."facility_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_lines" ADD CONSTRAINT "station_lines_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_lines" ADD CONSTRAINT "station_lines_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_car_structures" ADD CONSTRAINT "train_car_structures_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_equipments" ADD CONSTRAINT "train_equipments_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trains" ADD CONSTRAINT "trains_operators_operators_id_fk" FOREIGN KEY ("operators") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;