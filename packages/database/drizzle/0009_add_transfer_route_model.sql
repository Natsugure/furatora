CREATE TABLE "connection_routes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"connection_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"label" varchar(100) NOT NULL,
	"is_baseline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_connection_route_label" UNIQUE("connection_id","label"),
	CONSTRAINT "unique_connection_route" UNIQUE("connection_id","route_id")
);
--> statement-breakpoint
CREATE TABLE "transfer_connections" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"station_a_id" uuid NOT NULL,
	"direction_a" varchar(20) NOT NULL,
	"station_b_id" uuid NOT NULL,
	"direction_b" varchar(20) NOT NULL,
	"notes" text,
	"source" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_transfer_connection" UNIQUE("station_a_id","direction_a","station_b_id","direction_b"),
	CONSTRAINT "transfer_connection_endpoints_ordered" CHECK (("transfer_connections"."station_a_id", "transfer_connections"."direction_a") < ("transfer_connections"."station_b_id", "transfer_connections"."direction_b"))
);
--> statement-breakpoint
CREATE TABLE "transfer_route_facilities" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"route_id" uuid NOT NULL,
	"seq" smallint NOT NULL,
	"type_code" varchar NOT NULL,
	CONSTRAINT "unique_transfer_route_facility_seq" UNIQUE("route_id","seq")
);
--> statement-breakpoint
CREATE TABLE "transfer_routes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"minutes" smallint,
	"is_outdoor" boolean DEFAULT false NOT NULL,
	"requires_exit_gate" boolean DEFAULT false NOT NULL,
	"requires_staff" boolean DEFAULT false NOT NULL,
	"is_officially_guided" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "connection_routes" ADD CONSTRAINT "connection_routes_connection_id_transfer_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."transfer_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_routes" ADD CONSTRAINT "connection_routes_route_id_transfer_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."transfer_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_connections" ADD CONSTRAINT "transfer_connections_station_a_id_stations_id_fk" FOREIGN KEY ("station_a_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_connections" ADD CONSTRAINT "transfer_connections_station_b_id_stations_id_fk" FOREIGN KEY ("station_b_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_route_facilities" ADD CONSTRAINT "transfer_route_facilities_route_id_transfer_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."transfer_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_route_facilities" ADD CONSTRAINT "transfer_route_facilities_type_code_facility_types_code_fk" FOREIGN KEY ("type_code") REFERENCES "public"."facility_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_connection_baseline" ON "connection_routes" USING btree ("connection_id") WHERE "connection_routes"."is_baseline";