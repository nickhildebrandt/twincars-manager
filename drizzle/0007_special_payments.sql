CREATE TABLE IF NOT EXISTS "special_payment_employees" (
	"payment_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	CONSTRAINT "special_payment_employees_payment_id_employee_id_pk" PRIMARY KEY("payment_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "special_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(200) NOT NULL,
	"kind" varchar(20) DEFAULT 'one_time' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"start_month" date NOT NULL,
	"end_month" date,
	"target_all" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "special_payment_employees" ADD CONSTRAINT "special_payment_employees_payment_id_special_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."special_payments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "special_payment_employees" ADD CONSTRAINT "special_payment_employees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "special_payment_employees_employee_idx" ON "special_payment_employees" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "special_payments_start_month_idx" ON "special_payments" USING btree ("start_month");
