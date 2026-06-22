-- Migration 0015: remove the entire payroll / special-payment module.
--
-- The payroll feature has been superseded by the standalone
-- time-tracking module (`/hours`). All payroll/special-payment tables,
-- their generated payslip PDFs and the company-settings column that
-- controlled the auto-generation day are dropped.
--
-- Migrations 0006 (payroll_generation_day) and 0007 (special_payments)
-- are effectively rolled back here. We do not delete those migration
-- files because they are part of the recorded history; this migration
-- simply removes their schema effects.

DROP TABLE IF EXISTS "payroll_deductions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "payroll_line_items" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "payroll_entries" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "payroll_periods" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "payslip_pdfs" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "special_payment_employees" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "special_payments" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_settings" DROP COLUMN IF EXISTS "payroll_generation_day";
