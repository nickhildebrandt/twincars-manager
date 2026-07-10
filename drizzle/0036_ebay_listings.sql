-- Migration 0036: eBay listing import (integration Phase 2).
--
--   - ebay_listings     -- listings pulled from the connected seller
--                          account via the Trading API
--                          (GetMyeBaySelling). Idempotent import keyed
--                          on (environment, ebay_item_id); photos are
--                          stored by URL only; tire_id is the optional
--                          Phase-3 sync anchor (FK tires, SET NULL).
--   - ebay_import_runs  -- append-only log of operator-triggered
--                          import runs; the newest row backs the
--                          "last sync" info on /settings/ebay.

CREATE TABLE IF NOT EXISTS "ebay_listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ebay_item_id" varchar(30) NOT NULL,
  "sku" varchar(80),
  "title" varchar(255) NOT NULL,
  "price_value" numeric(12, 2),
  "price_currency" varchar(3),
  "quantity_available" integer,
  "quantity_sold" integer,
  "listing_type" varchar(30),
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "view_item_url" text,
  "gallery_url" text,
  "picture_urls" jsonb DEFAULT '[]'::jsonb,
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone,
  "environment" varchar(20) DEFAULT 'production' NOT NULL,
  "tire_id" uuid,
  "first_imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ebay_import_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "imported" integer DEFAULT 0 NOT NULL,
  "updated" integer DEFAULT 0 NOT NULL,
  "ended" integer DEFAULT 0 NOT NULL,
  "failed" integer DEFAULT 0 NOT NULL,
  "total_active" integer DEFAULT 0 NOT NULL,
  "error" text,
  "environment" varchar(20) DEFAULT 'production' NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "ebay_listings_env_item_idx"
  ON "ebay_listings" ("environment", "ebay_item_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ebay_listings_status_idx"
  ON "ebay_listings" ("status");
--> statement-breakpoint

-- Optional tire back-link for the later Phase-3 sync (pg-mem strips
-- DO blocks in tests; FK enforcement is not needed there).
DO $$ BEGIN
  ALTER TABLE "ebay_listings"
    ADD CONSTRAINT "ebay_listings_tire_id_tires_id_fk"
    FOREIGN KEY ("tire_id")
    REFERENCES "tires"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
