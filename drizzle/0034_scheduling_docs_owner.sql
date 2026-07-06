-- Migration 0034: scheduling split, vehicle documents, previous owner.
--
--   - work_orders.scheduled_at (timestamptz) splits into
--     scheduled_date (date) + scheduled_time (varchar(5), optional
--     HH:MM start time, no end time). Existing values are converted
--     as Europe/Berlin wall-clock before the old column is dropped.
--   - vehicles.previous_owner_customer_id — optional Vorbesitzer
--     back-link for stock vehicles (FK customers, SET NULL).
--   - vehicle_documents — file attachments per vehicle (bytea inline,
--     same storage reasoning as document_pdfs), index on vehicle_id.

ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "scheduled_date" date;
--> statement-breakpoint

ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "scheduled_time" varchar(5);
--> statement-breakpoint

-- Data migration: convert the timestamptz placement to Berlin
-- wall-clock date + HH:MM. Guarded by a column-existence check so a
-- re-run after the DROP below stays a no-op; wrapped in a DO block
-- (which the pg-mem test harness strips — fresh test DBs are empty).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'scheduled_at'
  ) THEN
    UPDATE "work_orders"
      SET "scheduled_date" = ("scheduled_at" AT TIME ZONE 'Europe/Berlin')::date,
          "scheduled_time" = to_char("scheduled_at" AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
      WHERE "scheduled_at" IS NOT NULL;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "work_orders" DROP COLUMN IF EXISTS "scheduled_at";
--> statement-breakpoint

ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "previous_owner_customer_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "vehicles"
    ADD CONSTRAINT "vehicles_previous_owner_customer_id_customers_id_fk"
    FOREIGN KEY ("previous_owner_customer_id")
    REFERENCES "customers"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "vehicle_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vehicle_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "mime" varchar(100) NOT NULL,
  "size_bytes" integer NOT NULL,
  "data" bytea NOT NULL,
  "note" varchar(500),
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "vehicle_documents"
    ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk"
    FOREIGN KEY ("vehicle_id")
    REFERENCES "vehicles"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "vehicle_documents_vehicle_id_idx"
  ON "vehicle_documents" ("vehicle_id");
