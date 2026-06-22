-- Migration 0017: photos for items (online-shop articles).
--
-- Same pattern as `vehicle_photos`: one row per photo, base64 data URL
-- inline so we don't need separate object storage. `is_main` flags the
-- cover image; `sort_order` controls gallery ordering. The public
-- article projection caps at the first 7 photos per item.

CREATE TABLE IF NOT EXISTS "item_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid NOT NULL,
  "mime" varchar(50) NOT NULL,
  "data_url" text NOT NULL,
  "is_main" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_photos_item_id_idx" ON "item_photos" ("item_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "item_photos" ADD CONSTRAINT "item_photos_item_id_fk"
    FOREIGN KEY ("item_id")
    REFERENCES "public"."items"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
