-- Migration 0020: GoBD-conformant invoice cancellation (Storno-Rechnung).
--
-- Per §§ 145 ff. AO and § 14 UStG, an invoice that has been issued/sent
-- cannot be deleted. Corrections happen exclusively via a separate
-- Storno-Rechnung (cancellation/credit-note) that exactly negates the
-- original. This migration adds the columns needed to record that
-- relationship without losing the audit trail.
--
-- Schema additions (all nullable, idempotent):
--   - documents.cancelled_at           -- set on the original when stornoed
--   - documents.cancellation_reason    -- free-text reason (≤500 chars)
--   - documents.cancelled_by_document_id  -- original → storno (FK self)
--   - documents.cancels_document_id    -- storno → original (FK self)
--
-- Mutual exclusion (one column or the other, never both) is enforced by
-- the service layer (`document-service.cancelInvoice`) — a CHECK
-- constraint would also work but would refuse partially-migrated rows
-- during a multi-step rollout.

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "cancellation_reason" varchar(500);
--> statement-breakpoint

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "cancelled_by_document_id" uuid;
--> statement-breakpoint

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "cancels_document_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "documents"
    ADD CONSTRAINT "documents_cancelled_by_fk"
    FOREIGN KEY ("cancelled_by_document_id")
    REFERENCES "documents"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "documents"
    ADD CONSTRAINT "documents_cancels_fk"
    FOREIGN KEY ("cancels_document_id")
    REFERENCES "documents"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "documents_cancelled_by_idx"
  ON "documents" ("cancelled_by_document_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "documents_cancels_idx"
  ON "documents" ("cancels_document_id");
--> statement-breakpoint

-- Seed the storno number range so `nextDocumentNumber('storno')` finds
-- a configured row. Prefix matches the invoice format ('S-{N}') so
-- audit reports group storno rows next to their originals.
INSERT INTO "number_ranges" ("kind", "format_template", "next_value")
  VALUES ('storno', 'S-{N}', 1)
  ON CONFLICT ("kind") DO NOTHING;
