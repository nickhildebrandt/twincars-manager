ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'created';--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "payroll_generation_day" integer DEFAULT 25 NOT NULL;
