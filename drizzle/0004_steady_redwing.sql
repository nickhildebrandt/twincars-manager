CREATE TABLE "payslip_pdfs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"filename" varchar(200) NOT NULL,
	"mime" varchar(50) DEFAULT 'application/pdf' NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "payslip_pdfs_entry_id_idx" ON "payslip_pdfs" USING btree ("entry_id");