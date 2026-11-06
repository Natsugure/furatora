ALTER TABLE "train_stop_patterns" ADD COLUMN "car_one_outer_meters" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "train_stop_patterns" ADD COLUMN "car_numbers_ascend_toward" varchar(10);--> statement-breakpoint
ALTER TABLE "train_stop_patterns" ADD CONSTRAINT "train_stop_patterns_ascend_toward_known" CHECK ("train_stop_patterns"."car_numbers_ascend_toward" IN ('plusX', 'minusX'));