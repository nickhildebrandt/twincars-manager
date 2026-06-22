-- Migration 0023: add notification delivery tracking to
-- `customer_inquiries`.
--
-- The public contact endpoint persists the inquiry first and only
-- then fires the workshop-internal notification mail. To make
-- transient SMTP failures observable (and retry-able) without losing
-- the inquiry itself, we track delivery on the row:
--
--   * `notification_status` — `pending` → `sent` | `failed`
--   * `notification_sent_at` — set when `notification_status='sent'`
--   * `notification_error`   — error message for the latest failed try
--
-- Ops can re-run the send from `/settings/inquiries` via
-- `retryInquiryNotificationRemote`. The columns use `IF NOT EXISTS`
-- so re-running the migration after a manual partial apply is safe.

ALTER TABLE "customer_inquiries"
  ADD COLUMN IF NOT EXISTS "notification_status" varchar(20) NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "customer_inquiries"
  ADD COLUMN IF NOT EXISTS "notification_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customer_inquiries"
  ADD COLUMN IF NOT EXISTS "notification_error" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_inquiries_notification_status_idx"
  ON "customer_inquiries" ("notification_status");
