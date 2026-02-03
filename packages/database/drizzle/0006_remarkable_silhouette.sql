ALTER TABLE "lines" ADD COLUMN "slug" varchar(100);--> statement-breakpoint
ALTER TABLE "lines" ADD COLUMN "display_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lines" ADD CONSTRAINT "lines_slug_unique" UNIQUE("slug");