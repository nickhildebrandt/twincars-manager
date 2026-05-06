CREATE TABLE "reminder_pdfs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_id" uuid NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"filename" varchar(200) NOT NULL,
	"mime" varchar(50) DEFAULT 'application/pdf' NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminder_pdfs" ADD CONSTRAINT "reminder_pdfs_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_pdfs_reminder_id_idx" ON "reminder_pdfs" USING btree ("reminder_id");