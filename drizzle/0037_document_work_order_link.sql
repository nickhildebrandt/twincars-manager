-- Migration 0037: order <-> invoice rule set (requirement 10).
--
--   - documents.work_order_id — backlink from every invoice that bills
--     a work order (the active invoice, cancelled originals AND their
--     Storno documents) to that order. work_orders.invoice_id remains
--     the pointer to the single ACTIVE invoice and is cleared when the
--     invoice is cancelled (the order reopens for corrections); this
--     backlink keeps the full billing history traceable in both
--     directions across re-invoicing cycles (GoBD).
--   - Backfill 1: invoices currently linked via work_orders.invoice_id
--     receive the backlink.
--   - Backfill 2: Storno documents inherit the backlink from the
--     original they cancel (cancels_document_id chain).

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "work_order_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "documents"
    ADD CONSTRAINT "documents_work_order_id_work_orders_id_fk"
    FOREIGN KEY ("work_order_id")
    REFERENCES "work_orders"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "documents_work_order_id_idx"
  ON "documents" ("work_order_id");
--> statement-breakpoint

-- Guarded, idempotent backfill (re-runs match zero rows). Wrapped in a
-- DO block: the pg-mem test harness strips DO blocks and fresh test
-- databases start empty, so nothing is lost there; production runs the
-- two UPDATEs once.
DO $$ BEGIN
  -- Pass 1: active links known via work_orders.invoice_id.
  UPDATE "documents" AS d
    SET "work_order_id" = w."id"
    FROM "work_orders" AS w
    WHERE w."invoice_id" = d."id"
      AND d."work_order_id" IS NULL;
  -- Pass 2: Storno documents inherit the link from their original.
  UPDATE "documents" AS s
    SET "work_order_id" = o."work_order_id"
    FROM "documents" AS o
    WHERE s."cancels_document_id" = o."id"
      AND o."work_order_id" IS NOT NULL
      AND s."work_order_id" IS NULL;
END $$;
