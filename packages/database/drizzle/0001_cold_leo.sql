CREATE TABLE "gtfs_metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"operator" varchar(50) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gtfs_metadata_operator_unique" UNIQUE("operator")
);
