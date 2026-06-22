-- Dedicated tire catalogue. Replaces the items.kind='tire' + JSONB
-- attributes approach. The workshop only sells tires; no general
-- articles. Items stays as the services / material catalogue.

CREATE TABLE IF NOT EXISTS tires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  article_number varchar(50) NOT NULL,
  legacy_article_number varchar(50),
  brand varchar(80) NOT NULL,
  model varchar(120) NOT NULL,
  width integer NOT NULL,
  aspect_ratio integer NOT NULL,
  construction varchar(5) NOT NULL DEFAULT 'R',
  diameter_inch integer NOT NULL,
  load_index varchar(10),
  speed_index varchar(5),
  season varchar(20) NOT NULL,
  ean varchar(20),
  manufacturer_part_number varchar(50),
  fuel_efficiency varchar(1),
  wet_grip varchar(1),
  noise_class varchar(1),
  noise_db integer,
  run_flat boolean NOT NULL DEFAULT false,
  reinforced boolean NOT NULL DEFAULT false,
  studded_winter boolean NOT NULL DEFAULT false,
  m_s_marking boolean NOT NULL DEFAULT false,
  snow_flake boolean NOT NULL DEFAULT false,
  ev_certified boolean NOT NULL DEFAULT false,
  description text,
  purchase_price_net numeric(12,2),
  stock_on_hand integer NOT NULL DEFAULT 0,
  stock_min integer,
  stock_max integer,
  online_sellable boolean NOT NULL DEFAULT false,
  discontinued boolean NOT NULL DEFAULT false,
  shipping_option_id uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS tires_article_number_idx ON tires (article_number);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tires_brand_idx ON tires (brand);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tires_size_idx ON tires (width, aspect_ratio, diameter_inch);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tires_season_idx ON tires (season);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tires_online_sellable_idx ON tires (online_sellable);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE tires ADD CONSTRAINT tires_shipping_option_id_fk
    FOREIGN KEY (shipping_option_id) REFERENCES shipping_options(id)
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS tire_price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tire_id uuid NOT NULL,
  valid_from date NOT NULL,
  unit_price_net numeric(12,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS tire_price_versions_tire_from_idx
  ON tire_price_versions (tire_id, valid_from);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE tire_price_versions ADD CONSTRAINT tire_price_versions_tire_id_fk
    FOREIGN KEY (tire_id) REFERENCES tires(id)
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS tire_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tire_id uuid NOT NULL,
  mime varchar(50) NOT NULL,
  data text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_main boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tire_photos_tire_idx ON tire_photos (tire_id);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE tire_photos ADD CONSTRAINT tire_photos_tire_id_fk
    FOREIGN KEY (tire_id) REFERENCES tires(id)
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Items becomes services-only. Drop the JSONB-based tire complexity.
DROP INDEX IF EXISTS items_attributes_gin_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS items_online_sellable_idx;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE items DROP CONSTRAINT IF EXISTS items_shipping_option_id_fk;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE items DROP COLUMN IF EXISTS attributes;
--> statement-breakpoint
ALTER TABLE items DROP COLUMN IF EXISTS online_sellable;
--> statement-breakpoint
ALTER TABLE items DROP COLUMN IF EXISTS shipping_option_id;
--> statement-breakpoint

-- item_photos was added for the online-shop attempt; we move photos
-- to tire_photos instead. Drop the unused table.
DROP TABLE IF EXISTS item_photos;
--> statement-breakpoint

-- document_items can now point at either an item (service) or a tire.
-- Both are nullable; the snapshot fields on the row are still the
-- source of truth for billing — the link is just for back-navigation.
ALTER TABLE document_items ADD COLUMN IF NOT EXISTS tire_id uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS document_items_tire_idx ON document_items (tire_id);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE document_items ADD CONSTRAINT document_items_tire_id_fk
    FOREIGN KEY (tire_id) REFERENCES tires(id)
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Number range for new tire article numbers (sequential plain {N}).
INSERT INTO number_ranges (kind, format_template, next_value)
  VALUES ('tire', '{N}', 1)
  ON CONFLICT (kind) DO NOTHING;
