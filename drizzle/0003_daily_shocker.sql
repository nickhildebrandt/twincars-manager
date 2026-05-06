CREATE TABLE "payroll_deductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"position_number" integer DEFAULT 1 NOT NULL,
	"kind" varchar(30) NOT NULL,
	"label" varchar(200) NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_employer" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "payroll_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"position_number" integer DEFAULT 1 NOT NULL,
	"kind" varchar(30) DEFAULT 'base' NOT NULL,
	"label" varchar(200) NOT NULL,
	"quantity" numeric(10, 3),
	"unit" varchar(20),
	"rate" numeric(12, 2),
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "employee_absences" ADD COLUMN "attachment_mime" varchar(50);--> statement-breakpoint
ALTER TABLE "employee_absences" ADD COLUMN "attachment_name" varchar(200);--> statement-breakpoint
ALTER TABLE "employee_absences" ADD COLUMN "attachment_data" text;--> statement-breakpoint
ALTER TABLE "employee_absences" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "working_days" integer;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "vacation_days_used" numeric(5, 1) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "sick_days" numeric(5, 1) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "tax_total" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "social_employee_total" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "social_employer_total" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "payout_date" date;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "payout_method" varchar(30) DEFAULT 'Überweisung' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "status" varchar(20) DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_entry_id_payroll_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_entry_id_payroll_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_absences_employee_id_idx" ON "employee_absences" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_absences_date_from_idx" ON "employee_absences" USING btree ("date_from");