CREATE TABLE "station_adjacencies" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"line_id" uuid NOT NULL,
	"station_a_id" uuid NOT NULL,
	"station_b_id" uuid NOT NULL,
	CONSTRAINT "unique_station_adjacency" UNIQUE("line_id","station_a_id","station_b_id")
);
--> statement-breakpoint
CREATE TABLE "station_groups" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"ekidata_station_group_cd" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_kana" varchar(100),
	"pref_code" integer,
	"lat" numeric(9, 6),
	"lon" numeric(9, 6),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "station_groups_ekidata_station_group_cd_unique" UNIQUE("ekidata_station_group_cd")
);
--> statement-breakpoint
ALTER TABLE "lines" ADD COLUMN "ekidata_line_cd" integer;--> statement-breakpoint
ALTER TABLE "lines" ADD COLUMN "abolished_at" date;--> statement-breakpoint
ALTER TABLE "operators" ADD COLUMN "ekidata_company_cd" integer;--> statement-breakpoint
ALTER TABLE "station_connections" ADD COLUMN "source" varchar(20);--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "ekidata_station_cd" integer;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "station_group_id" uuid;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "pref_code" integer;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "abolished_at" date;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "station_adjacencies" ADD CONSTRAINT "station_adjacencies_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_adjacencies" ADD CONSTRAINT "station_adjacencies_station_a_id_stations_id_fk" FOREIGN KEY ("station_a_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_adjacencies" ADD CONSTRAINT "station_adjacencies_station_b_id_stations_id_fk" FOREIGN KEY ("station_b_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_station_group_id_station_groups_id_fk" FOREIGN KEY ("station_group_id") REFERENCES "public"."station_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lines" ADD CONSTRAINT "lines_ekidata_line_cd_unique" UNIQUE("ekidata_line_cd");--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_ekidata_company_cd_unique" UNIQUE("ekidata_company_cd");--> statement-breakpoint
ALTER TABLE "station_connections" ADD CONSTRAINT "unique_station_connection" UNIQUE("station_id","connected_station_id");--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_ekidata_station_cd_unique" UNIQUE("ekidata_station_cd");--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "published_requires_slug" CHECK (published_at IS NULL OR slug IS NOT NULL);