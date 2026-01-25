CREATE TABLE "lines" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"gtfs_route_id" varchar(10),
	"short_name" varchar(50),
	"long_name" varchar(100) NOT NULL,
	"color" varchar(6),
	"operators" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uniqueRoutePerOperator" UNIQUE("gtfs_route_id","operators")
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" varchar(100) NOT NULL,
	"gtfs_agency_id" varchar(100),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "operators_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "station_accessibility" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"station_id" uuid NOT NULL,
	"elevators" jsonb,
	"accessible_routes" jsonb,
	"notes" text,
	"verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "station_lines" (
	"station_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	CONSTRAINT "station_lines_station_id_line_id_pk" PRIMARY KEY("station_id","line_id")
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"gtfs_stop_id" varchar(10),
	"code" varchar(20),
	"name" varchar(100) NOT NULL,
	"lat" numeric(9, 6),
	"lon" numeric(9, 6),
	"wheelchair_boarding" integer,
	"operators" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "uniqueStopPerOperator" UNIQUE("gtfs_stop_id","operators")
);
--> statement-breakpoint
CREATE TABLE "trains" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" varchar(100) NOT NULL,
	"operators" uuid NOT NULL,
	"lines" uuid[] NOT NULL,
	"free_spaces" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "lines" ADD CONSTRAINT "lines_operators_operators_id_fk" FOREIGN KEY ("operators") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_accessibility" ADD CONSTRAINT "station_accessibility_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_lines" ADD CONSTRAINT "station_lines_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_lines" ADD CONSTRAINT "station_lines_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_operators_operators_id_fk" FOREIGN KEY ("operators") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trains" ADD CONSTRAINT "trains_operators_operators_id_fk" FOREIGN KEY ("operators") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;