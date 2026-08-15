CREATE TABLE "train_stop_pattern_cars" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"train_stop_pattern_id" uuid NOT NULL,
	"car_number" integer NOT NULL,
	"start_meters" numeric(6, 2) NOT NULL,
	"end_meters" numeric(6, 2) NOT NULL,
	CONSTRAINT "unique_train_stop_pattern_car" UNIQUE("train_stop_pattern_id","car_number")
);
--> statement-breakpoint
CREATE TABLE "train_stop_patterns" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"platform_id" uuid NOT NULL,
	"train_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_train_stop_pattern" UNIQUE("platform_id","train_id")
);
--> statement-breakpoint
DROP TABLE "platform_car_stop_positions" CASCADE;--> statement-breakpoint
ALTER TABLE "facility_connections" ADD COLUMN "x_range_start" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "facility_connections" ADD COLUMN "x_range_end" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "platform_location_cells" ADD COLUMN "x_position_meters" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "physical_length" numeric(6, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "train_car_structures" ADD COLUMN "car_length" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "train_stop_pattern_cars" ADD CONSTRAINT "train_stop_pattern_cars_train_stop_pattern_id_train_stop_patterns_id_fk" FOREIGN KEY ("train_stop_pattern_id") REFERENCES "public"."train_stop_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_stop_patterns" ADD CONSTRAINT "train_stop_patterns_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_stop_patterns" ADD CONSTRAINT "train_stop_patterns_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_location_cells" DROP COLUMN "near_platform_cell";--> statement-breakpoint
ALTER TABLE "platforms" DROP COLUMN "max_car_count";--> statement-breakpoint
ALTER TABLE "trains" DROP COLUMN "limited_to_platform_ids";