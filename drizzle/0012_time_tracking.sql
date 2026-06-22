-- Migration 0012: time tracking (Stundenerfassung).
--
-- Replaces the (still-present) payroll module's role in capturing
-- worked hours with a leaner per-task / per-document time-entry model.
-- One row = one employee logging a date + duration against either a
-- specific document (offer/invoice/order) or a free-text task.
--
-- The payroll tables stay in place for now — they're gated behind
-- `settings:write` and slated for a follow-up cleanup pass.

CREATE TABLE IF NOT EXISTS "time_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "date" date NOT NULL,
  /** Hours worked, e.g. 1.50 = 1h 30min. */
  "hours" numeric(6, 2) NOT NULL,
  /** Optional link to a document (offer, invoice, order). */
  "document_id" uuid,
  /** Optional link to a customer (when no specific document applies). */
  "customer_id" uuid,
  "task" varchar(200),
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_employee_id_idx" ON "time_entries" ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_date_idx" ON "time_entries" ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_document_id_idx" ON "time_entries" ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_customer_id_idx" ON "time_entries" ("customer_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employee_id_fk"
    FOREIGN KEY ("employee_id")
    REFERENCES "public"."employees"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_document_id_fk"
    FOREIGN KEY ("document_id")
    REFERENCES "public"."documents"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_customer_id_fk"
    FOREIGN KEY ("customer_id")
    REFERENCES "public"."customers"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
