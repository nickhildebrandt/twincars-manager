-- Live progress for the KFZ-Kaufmann import: the UI polls the newest
-- job row and renders a percentage bar + step label.
ALTER TABLE "access_import_jobs" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "access_import_jobs" ADD COLUMN IF NOT EXISTS "progress_label" varchar(200);
