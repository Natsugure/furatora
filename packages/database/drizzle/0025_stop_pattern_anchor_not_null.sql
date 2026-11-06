ALTER TABLE "train_stop_pattern_cars" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "train_stop_pattern_cars" CASCADE;--> statement-breakpoint
ALTER TABLE "train_stop_patterns" ALTER COLUMN "car_one_outer_meters" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "train_stop_patterns" ALTER COLUMN "car_numbers_ascend_toward" SET NOT NULL;