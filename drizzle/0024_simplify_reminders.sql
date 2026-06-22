-- Zahlungserinnerung simplification: drop fees, drop multi-stage
-- columns, rename number-range template from MA-… to ZE-… (the
-- internal kind 'reminder' stays so existing rows keep their FKs).

ALTER TABLE company_settings DROP COLUMN IF EXISTS reminder_days_2;
ALTER TABLE company_settings DROP COLUMN IF EXISTS reminder_days_3;
ALTER TABLE company_settings DROP COLUMN IF EXISTS reminder_days_4;
ALTER TABLE company_settings DROP COLUMN IF EXISTS reminder_fee_1;
ALTER TABLE company_settings DROP COLUMN IF EXISTS reminder_fee_2;
ALTER TABLE company_settings DROP COLUMN IF EXISTS reminder_fee_3;
ALTER TABLE company_settings DROP COLUMN IF EXISTS reminder_fee_4;
ALTER TABLE company_settings DROP COLUMN IF EXISTS reminder_interest_rate;
--> statement-breakpoint

ALTER TABLE reminders DROP COLUMN IF EXISTS fee;
ALTER TABLE reminders DROP COLUMN IF EXISTS interest;
--> statement-breakpoint

-- Bump the default for new installs to 14 days (alle zwei Wochen) —
-- existing rows keep whatever interval the operator already chose.
ALTER TABLE company_settings
  ALTER COLUMN reminder_recur_every_days SET DEFAULT 14;
--> statement-breakpoint

UPDATE number_ranges
  SET format_template = 'ZE-{YYYY}-{NNNN}'
  WHERE kind = 'reminder' AND format_template = 'MA-{YYYY}-{NNNN}';
