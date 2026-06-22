-- Migration 0016: customer_inquiries table for the public contact form.
--
-- External-website visitors submit free-form inquiries through
-- `POST /api/public/contact`. Each row records the contact data, the
-- subject + message and an optional `reference_id`/`reference_type`
-- that links the inquiry to a used-car listing or an article the
-- visitor was looking at. `customer_id` stays nullable on purpose —
-- most submitters are leads, not existing customers.
--
-- `status` is a free-form workflow flag used by the inbox UI later
-- (`new` / `read` / `archived`). The API never accepts it on
-- submission.

CREATE TABLE IF NOT EXISTS "customer_inquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid,
  "customer_email" varchar(254) NOT NULL,
  "customer_name" varchar(200) NOT NULL,
  "customer_phone" varchar(30),
  "subject" varchar(200) NOT NULL,
  "message" text NOT NULL,
  "reference_id" varchar(64),
  "reference_type" varchar(20),
  "status" varchar(20) NOT NULL DEFAULT 'new',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_inquiries_created_at_idx" ON "customer_inquiries" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_inquiries_status_idx" ON "customer_inquiries" ("status");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "customer_inquiries" ADD CONSTRAINT "customer_inquiries_customer_id_fk"
    FOREIGN KEY ("customer_id")
    REFERENCES "public"."customers"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
