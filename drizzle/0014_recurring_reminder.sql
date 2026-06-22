-- Migration 0014: recurring payment-reminder interval.
--
-- Business simplification: there is no longer a 1./2./3. Mahnung
-- escalation. The operator configures a single friendly
-- "Zahlungserinnerung" template that keeps going out at a fixed
-- recurring interval until the invoice is paid.
--
-- `reminder_days_1` keeps its original meaning ("days after due date
-- for the first reminder"). The new `reminder_recur_every_days` is the
-- gap between successive reminders for the same invoice.
--
-- Legacy columns `reminder_days_2/3/4` and `reminder_fee_2/3/4` stay
-- for backwards compatibility with rows that already carry data; the
-- UI no longer surfaces them.

ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "reminder_recur_every_days" integer
  NOT NULL DEFAULT 7;
