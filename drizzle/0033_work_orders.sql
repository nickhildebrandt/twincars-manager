-- Migration 0033: Aufträge (work orders) — Kanban shop-floor jobs.
--
-- See docs/specs/2026-07-06-work-orders-design.md. Adds:
--   - work_orders            -- job from intake to invoice
--   - work_order_assignees   -- m:n order <-> employee
--   - work_order_items       -- performed positions (labor / material)
--   - time_entries.work_order_id / .work_order_item_id
--        write-through back-links: every labor item with employee +
--        hours mirrors exactly ONE time_entries row (unique partial
--        index); deleting the item cascades the entry away.
--   - company_settings.labor_item_id
--        the designated "Arbeitszeit" catalog item whose current price
--        version is the workshop labor rate (seedDefaults links it).
--   - `orders` permission grant for the existing Werkstattleiter /
--     Mitarbeiter roles so deployed instances see the module without
--     manual role edits.

CREATE TABLE IF NOT EXISTS "work_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_number" varchar(50) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "customer_id" uuid,
  "vehicle_id" uuid,
  "appointment_id" uuid,
  "invoice_id" uuid,
  "scheduled_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "work_orders_order_number_unique" UNIQUE ("order_number")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "work_order_assignees" (
  "work_order_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  CONSTRAINT "work_order_assignees_work_order_id_employee_id_pk"
    PRIMARY KEY ("work_order_id", "employee_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "work_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "work_order_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "kind" varchar(20) DEFAULT 'labor' NOT NULL,
  "item_id" uuid,
  "description" text NOT NULL,
  "quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
  "unit" varchar(20),
  "unit_price_net" numeric(12, 2) NOT NULL,
  "employee_id" uuid,
  "hours" numeric(6, 2),
  "done_at" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "work_orders"
    ADD CONSTRAINT "work_orders_customer_id_customers_id_fk"
    FOREIGN KEY ("customer_id")
    REFERENCES "customers"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "work_orders"
    ADD CONSTRAINT "work_orders_vehicle_id_vehicles_id_fk"
    FOREIGN KEY ("vehicle_id")
    REFERENCES "vehicles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "work_orders"
    ADD CONSTRAINT "work_orders_appointment_id_calendar_entries_id_fk"
    FOREIGN KEY ("appointment_id")
    REFERENCES "calendar_entries"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "work_orders"
    ADD CONSTRAINT "work_orders_invoice_id_documents_id_fk"
    FOREIGN KEY ("invoice_id")
    REFERENCES "documents"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "work_order_assignees"
    ADD CONSTRAINT "work_order_assignees_work_order_id_work_orders_id_fk"
    FOREIGN KEY ("work_order_id")
    REFERENCES "work_orders"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "work_order_assignees"
    ADD CONSTRAINT "work_order_assignees_employee_id_employees_id_fk"
    FOREIGN KEY ("employee_id")
    REFERENCES "employees"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "work_order_items"
    ADD CONSTRAINT "work_order_items_work_order_id_work_orders_id_fk"
    FOREIGN KEY ("work_order_id")
    REFERENCES "work_orders"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "work_order_items"
    ADD CONSTRAINT "work_order_items_item_id_items_id_fk"
    FOREIGN KEY ("item_id")
    REFERENCES "items"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "work_order_items"
    ADD CONSTRAINT "work_order_items_employee_id_employees_id_fk"
    FOREIGN KEY ("employee_id")
    REFERENCES "employees"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "work_orders_status_idx"
  ON "work_orders" ("status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "work_orders_customer_id_idx"
  ON "work_orders" ("customer_id");
--> statement-breakpoint

DO $$ BEGIN
  -- One order per Termin (partial unique — directly created orders
  -- have no appointment and must not collide on NULL). Wrapped in
  -- DO $$ so the pg-mem test harness strips it: pg-mem answers
  -- `appointment_id IS NULL` through the partial index (which only
  -- holds non-null rows) and would return zero rows; the service-level
  -- duplicate check covers the invariant in tests.
  CREATE UNIQUE INDEX IF NOT EXISTS "work_orders_appointment_id_idx"
    ON "work_orders" ("appointment_id") WHERE "appointment_id" IS NOT NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "work_orders_invoice_id_idx"
  ON "work_orders" ("invoice_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "work_order_items_work_order_id_idx"
  ON "work_order_items" ("work_order_id");
--> statement-breakpoint

ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "work_order_id" uuid;
--> statement-breakpoint

ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "work_order_item_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "time_entries"
    ADD CONSTRAINT "time_entries_work_order_id_work_orders_id_fk"
    FOREIGN KEY ("work_order_id")
    REFERENCES "work_orders"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "time_entries"
    ADD CONSTRAINT "time_entries_work_order_item_id_work_order_items_id_fk"
    FOREIGN KEY ("work_order_item_id")
    REFERENCES "work_order_items"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "time_entries_work_order_id_idx"
  ON "time_entries" ("work_order_id");
--> statement-breakpoint

DO $$ BEGIN
  -- Exactly one time entry per labor work item (write-through upsert).
  -- DO $$ wrapper for the same pg-mem partial-index reason as above.
  CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_work_order_item_id_idx"
    ON "time_entries" ("work_order_item_id")
    WHERE "work_order_item_id" IS NOT NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "labor_item_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "company_settings"
    ADD CONSTRAINT "company_settings_labor_item_id_items_id_fk"
    FOREIGN KEY ("labor_item_id")
    REFERENCES "items"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Seed the work-order number range so `allocateNumber('work_order')`
-- finds a configured row even before the first `seedDefaults()` run.
INSERT INTO "number_ranges" ("kind", "format_template", "next_value")
  VALUES ('work_order', 'AU-{YYYY}-{NNNN}', 1)
  ON CONFLICT ("kind") DO NOTHING;
--> statement-breakpoint

-- Grant the new `orders` module permission to the existing seeded
-- roles: the shop floor (Mitarbeiter) is the point of the module and
-- Werkstattleiter has every non-admin module. Administrator inherits
-- via the wildcard. Idempotent on the (role_id, permission) PK.
INSERT INTO "role_permissions" ("role_id", "permission")
  SELECT r."id", 'orders' FROM "roles" r
  WHERE r."name" IN ('Werkstattleiter', 'Mitarbeiter')
  ON CONFLICT DO NOTHING;
