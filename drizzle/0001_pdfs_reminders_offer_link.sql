CREATE TABLE "document_pdfs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"filename" varchar(200) NOT NULL,
	"mime" varchar(50) DEFAULT 'application/pdf' NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" varchar(50) NOT NULL,
	"invoice_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"interest" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "small_business_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_auto_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_days_1" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_days_2" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_days_3" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_days_4" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_fee_1" numeric(12, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_fee_2" numeric(12, 2) DEFAULT '5.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_fee_3" numeric(12, 2) DEFAULT '10.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_fee_4" numeric(12, 2) DEFAULT '15.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "reminder_interest_rate" numeric(5, 2) DEFAULT '9.62' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "converted_to_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reminder_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_pdfs" ADD CONSTRAINT "document_pdfs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_invoice_id_documents_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_pdfs_document_id_idx" ON "document_pdfs" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_invoice_level_idx" ON "reminders" USING btree ("invoice_id","level");--> statement-breakpoint
CREATE INDEX "reminders_invoice_id_idx" ON "reminders" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "reminders_status_idx" ON "reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_converted_to_invoice_idx" ON "documents" USING btree ("converted_to_invoice_id");