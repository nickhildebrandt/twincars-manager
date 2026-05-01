CREATE TABLE "access_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"tables_processed" integer DEFAULT 0 NOT NULL,
	"rows_imported" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"customer_id" uuid,
	"vehicle_id" uuid,
	"employee_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notes" text,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setup_completed" boolean DEFAULT false NOT NULL,
	"company_name" varchar(200) DEFAULT '' NOT NULL,
	"owner" varchar(200),
	"street" varchar(200) DEFAULT '' NOT NULL,
	"zip" varchar(10) DEFAULT '' NOT NULL,
	"city" varchar(150) DEFAULT '' NOT NULL,
	"state" varchar(50) DEFAULT '' NOT NULL,
	"phone" varchar(30) DEFAULT '' NOT NULL,
	"mobile" varchar(30),
	"fax" varchar(30),
	"email" varchar(254) DEFAULT '' NOT NULL,
	"website" varchar(2048),
	"vat_id" varchar(30),
	"tax_number" varchar(30),
	"bank_name" varchar(100),
	"iban" varchar(34),
	"bic" varchar(11),
	"default_payment_term_days" integer DEFAULT 14 NOT NULL,
	"default_currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"default_vat_rate" numeric(5, 2) DEFAULT '19.00' NOT NULL,
	"salutation_style" varchar(10) DEFAULT 'Sie' NOT NULL,
	"logo_mime" varchar(50),
	"logo_data" text,
	"pdf_footer" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_number" varchar(50) NOT NULL,
	"legacy_customer_number" varchar(50),
	"company" varchar(200),
	"salutation" varchar(30),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"street" varchar(200),
	"zip" varchar(10),
	"city" varchar(150),
	"country" varchar(100) DEFAULT 'Deutschland',
	"phone" varchar(30),
	"phone2" varchar(30),
	"mobile" varchar(30),
	"fax" varchar(30),
	"email" varchar(254),
	"website" varchar(2048),
	"birthday" date,
	"notes" text,
	"payment_term_days" integer,
	"vat_id" varchar(30),
	"bank_iban" varchar(34),
	"bank_bic" varchar(11),
	"bank_name" varchar(100),
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"position_number" integer NOT NULL,
	"kind" varchar(20) DEFAULT 'article' NOT NULL,
	"item_id" uuid,
	"article_number" varchar(50),
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit" varchar(20),
	"unit_price_net" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '19.00' NOT NULL,
	"line_total_net" numeric(12, 2) DEFAULT '0' NOT NULL,
	"line_total_gross" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" varchar(30),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" varchar(50) NOT NULL,
	"legacy_document_number" varchar(50),
	"type" varchar(30) NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"customer_id" uuid,
	"vehicle_id" uuid,
	"issue_date" date NOT NULL,
	"service_date" date,
	"due_date" date,
	"payment_method" varchar(30),
	"tax_rate" numeric(5, 2) DEFAULT '19.00' NOT NULL,
	"net_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gross_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"header" text,
	"footer" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"half_day" boolean DEFAULT false NOT NULL,
	"notes" text,
	"status" varchar(20) DEFAULT 'approved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personnel_number" varchar(30) NOT NULL,
	"salutation" varchar(30),
	"title" varchar(30),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"birthday" date,
	"birthplace" varchar(100),
	"nationality" varchar(50),
	"street" varchar(200),
	"zip" varchar(10),
	"city" varchar(150),
	"country" varchar(100) DEFAULT 'Deutschland',
	"private_email" varchar(254),
	"private_phone" varchar(30),
	"mobile" varchar(30),
	"hire_date" date,
	"termination_date" date,
	"position" varchar(150),
	"department" varchar(100),
	"employment_type" varchar(30),
	"weekly_hours" numeric(5, 2),
	"monthly_salary" numeric(12, 2),
	"hourly_wage" numeric(8, 2),
	"vacation_days_per_year" integer,
	"tax_id" varchar(30),
	"tax_class" varchar(5),
	"social_insurance_number" varchar(30),
	"health_insurance" varchar(100),
	"bank_account_holder" varchar(200),
	"bank_iban" varchar(34),
	"bank_bic" varchar(11),
	"bank_name" varchar(100),
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_item_number" varchar(50),
	"article_number" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"kind" varchar(20) DEFAULT 'article' NOT NULL,
	"unit" varchar(20),
	"unit_price_net" numeric(12, 2) DEFAULT '0' NOT NULL,
	"purchase_price_net" numeric(12, 2),
	"stock_on_hand" integer DEFAULT 0 NOT NULL,
	"stock_min" integer,
	"stock_max" integer,
	"discontinued" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"default_tax_rate" numeric(5, 2),
	CONSTRAINT "ledger_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" varchar(50),
	"direction" varchar(10) NOT NULL,
	"entry_date" date NOT NULL,
	"amount_gross" numeric(12, 2) NOT NULL,
	"amount_net" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '19.00' NOT NULL,
	"category_id" uuid,
	"description" text NOT NULL,
	"payment_method" varchar(30),
	"payment_status" varchar(20) DEFAULT 'paid' NOT NULL,
	"supplier_id" uuid,
	"customer_id" uuid,
	"document_id" uuid,
	"source" varchar(30) DEFAULT 'manual' NOT NULL,
	"recurring_template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(30) NOT NULL,
	"format_template" varchar(50) NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "number_ranges_kind_unique" UNIQUE("kind")
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"gross_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deductions_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payout_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(50) NOT NULL,
	"date" date NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"category_id" uuid,
	"supplier_id" uuid,
	"amount_gross" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '19.00' NOT NULL,
	"payment_method" varchar(30),
	"interval_kind" varchar(20) NOT NULL,
	"interval_every" integer DEFAULT 1 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"occurrences_limit" integer,
	"occurrences_created" integer DEFAULT 0 NOT NULL,
	"next_run_date" date NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"document_type" varchar(30) NOT NULL,
	"recipient_email" varchar(254) NOT NULL,
	"recipient_name" varchar(200),
	"subject" varchar(200) NOT NULL,
	"body_text" text NOT NULL,
	"attachment_meta" jsonb DEFAULT '[]'::jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"smtp_message_id" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "smtp_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host" varchar(255) DEFAULT '' NOT NULL,
	"port" integer DEFAULT 587 NOT NULL,
	"secure" varchar(10) DEFAULT 'STARTTLS' NOT NULL,
	"username" varchar(200) DEFAULT '' NOT NULL,
	"password_encrypted" text DEFAULT '' NOT NULL,
	"from_address" varchar(254) DEFAULT '' NOT NULL,
	"from_name" varchar(200) DEFAULT '' NOT NULL,
	"reply_to" varchar(254),
	"verified" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_supplier_number" varchar(50),
	"name" varchar(200) NOT NULL,
	"customer_number_at_supplier" varchar(50),
	"contact_person" varchar(100),
	"street" varchar(200),
	"zip" varchar(10),
	"city" varchar(150),
	"country" varchar(100),
	"phone" varchar(30),
	"fax" varchar(30),
	"email" varchar(254),
	"website" varchar(2048),
	"bank_name" varchar(100),
	"iban" varchar(34),
	"bic" varchar(11),
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'available' NOT NULL,
	"sales_price_gross" numeric(12, 2),
	"differential_tax" boolean DEFAULT false NOT NULL,
	"highlights" text,
	"equipment" jsonb DEFAULT '[]'::jsonb,
	"location" varchar(100),
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"mime" varchar(50) NOT NULL,
	"data_url" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"purchase_date" date NOT NULL,
	"purchase_price" numeric(12, 2) NOT NULL,
	"previous_owner" varchar(200),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_id" uuid,
	"sale_date" date NOT NULL,
	"sales_price_gross" numeric(12, 2) NOT NULL,
	"trade_in_value" numeric(12, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"legacy_vehicle_id" varchar(50),
	"make" varchar(100),
	"model" varchar(150),
	"license_plate" varchar(20),
	"vin" varchar(25),
	"first_registration" date,
	"mileage_km" integer,
	"next_hu" date,
	"next_au" date,
	"hsn" varchar(10),
	"tsn" varchar(10),
	"displacement_ccm" integer,
	"power_kw" integer,
	"color_code" varchar(30),
	"engine_number" varchar(50),
	"fuel_type" varchar(30),
	"gearbox" varchar(30),
	"body_type" varchar(50),
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_payments" ADD CONSTRAINT "document_payments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_absences" ADD CONSTRAINT "employee_absences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_category_id_ledger_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ledger_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_category_id_ledger_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ledger_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_purchases" ADD CONSTRAINT "vehicle_purchases_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_sales" ADD CONSTRAINT "vehicle_sales_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_sales" ADD CONSTRAINT "vehicle_sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_customer_number_idx" ON "customers" USING btree ("customer_number");--> statement-breakpoint
CREATE INDEX "customers_last_name_idx" ON "customers" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "customers_company_idx" ON "customers" USING btree ("company");--> statement-breakpoint
CREATE INDEX "customers_zip_idx" ON "customers" USING btree ("zip");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_document_number_idx" ON "documents" USING btree ("document_number");--> statement-breakpoint
CREATE INDEX "documents_customer_id_idx" ON "documents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "documents_type_status_idx" ON "documents" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "documents_issue_date_idx" ON "documents" USING btree ("issue_date");--> statement-breakpoint
CREATE UNIQUE INDEX "items_article_number_idx" ON "items" USING btree ("article_number");--> statement-breakpoint
CREATE INDEX "items_kind_idx" ON "items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "ledger_entries_entry_date_idx" ON "ledger_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "ledger_entries_direction_idx" ON "ledger_entries" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "ledger_entries_category_id_idx" ON "ledger_entries" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mail_templates_key_idx" ON "mail_templates" USING btree ("key");--> statement-breakpoint
CREATE INDEX "sent_messages_sent_at_idx" ON "sent_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "sent_messages_document_id_idx" ON "sent_messages" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "vehicles_customer_id_idx" ON "vehicles" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "vehicles_license_plate_idx" ON "vehicles" USING btree ("license_plate");--> statement-breakpoint
CREATE INDEX "vehicles_vin_idx" ON "vehicles" USING btree ("vin");--> statement-breakpoint
CREATE INDEX "vehicles_next_hu_idx" ON "vehicles" USING btree ("next_hu");