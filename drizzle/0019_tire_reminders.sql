-- Migration 0019: tire-change reminder mails.
--
-- Adds a customer-level opt-in flag `wants_tire_reminders` (independent
-- from the existing `wants_broadcast` newsletter flag) and a
-- `tire_reminder_log` table that records every reminder send so the
-- twice-yearly job stays idempotent inside one season/year.

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "wants_tire_reminders" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tire_reminder_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "season" varchar(20) NOT NULL,
  "year" integer NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tire_reminder_log_unique" UNIQUE ("customer_id", "season", "year")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tire_reminder_log_customer_id_idx"
  ON "tire_reminder_log" ("customer_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tire_reminder_log_season_year_idx"
  ON "tire_reminder_log" ("season", "year");
