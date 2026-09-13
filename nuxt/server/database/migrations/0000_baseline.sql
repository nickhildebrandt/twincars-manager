CREATE TABLE IF NOT EXISTS "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" varchar(100) NOT NULL,
	CONSTRAINT "role_permissions_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" text NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"status" varchar(20),
	"customer_id" uuid,
	"vehicle_id" uuid,
	"employee_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_price_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"unit_price_net" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_item_number" varchar(50),
	"article_number" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"kind" varchar(20) DEFAULT 'article' NOT NULL,
	"unit" varchar(20),
	"purchase_price_net" integer,
	"stock_on_hand" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"online_bookable" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tire_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tire_id" uuid NOT NULL,
	"mime" varchar(50) NOT NULL,
	"data" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tire_price_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tire_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"unit_price_net" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_number" varchar(50) NOT NULL,
	"legacy_article_number" varchar(50),
	"brand" varchar(80) NOT NULL,
	"model" varchar(120) NOT NULL,
	"width" integer NOT NULL,
	"aspect_ratio" integer NOT NULL,
	"construction" varchar(5) DEFAULT 'R' NOT NULL,
	"diameter_inch" integer NOT NULL,
	"load_index" varchar(10),
	"speed_index" varchar(5),
	"season" varchar(20) NOT NULL,
	"ean" varchar(20),
	"manufacturer_part_number" varchar(50),
	"fuel_efficiency" varchar(1),
	"wet_grip" varchar(1),
	"noise_class" varchar(1),
	"noise_db" integer,
	"run_flat" boolean DEFAULT false NOT NULL,
	"reinforced" boolean DEFAULT false NOT NULL,
	"studded_winter" boolean DEFAULT false NOT NULL,
	"m_s_marking" boolean DEFAULT false NOT NULL,
	"snow_flake" boolean DEFAULT false NOT NULL,
	"ev_certified" boolean DEFAULT false NOT NULL,
	"description" text,
	"purchase_price_net" integer,
	"stock_on_hand" integer DEFAULT 0 NOT NULL,
	"online_sellable" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"excerpt" varchar(500),
	"body" text NOT NULL,
	"cover_image" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sent_messages" (
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
CREATE TABLE IF NOT EXISTS "smtp_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host" varchar(255) DEFAULT '' NOT NULL,
	"port" integer DEFAULT 587 NOT NULL,
	"secure" varchar(10) DEFAULT 'STARTTLS' NOT NULL,
	"username" varchar(200) DEFAULT '' NOT NULL,
	"password" text DEFAULT '' NOT NULL,
	"from_address" varchar(254) DEFAULT '' NOT NULL,
	"from_name" varchar(200) DEFAULT '' NOT NULL,
	"reply_to" varchar(254),
	"verified" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notification_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"notification_sent_at" timestamp with time zone,
	"notification_error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" varchar(20) DEFAULT 'privat' NOT NULL,
	"ebay_handle" varchar(100),
	"wants_broadcast" boolean DEFAULT false NOT NULL,
	"wants_tire_reminders" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
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
CREATE TABLE IF NOT EXISTS "document_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"position_number" integer NOT NULL,
	"kind" varchar(20) DEFAULT 'article' NOT NULL,
	"item_id" uuid,
	"article_number" varchar(50),
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit" varchar(20),
	"unit_price_net" integer DEFAULT 0 NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '19.00' NOT NULL,
	"line_total_net" integer DEFAULT 0 NOT NULL,
	"line_total_gross" integer DEFAULT 0 NOT NULL,
	"tire_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"amount" integer NOT NULL,
	"method" varchar(30),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_pdfs" (
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
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" varchar(50) NOT NULL,
	"legacy_document_number" varchar(50),
	"type" varchar(30) NOT NULL,
	"status" varchar(30) DEFAULT 'created' NOT NULL,
	"customer_id" uuid,
	"vehicle_id" uuid,
	"issue_date" date NOT NULL,
	"service_date" date,
	"due_date" date,
	"payment_method" varchar(30),
	"tax_rate" numeric(5, 2) DEFAULT '19.00' NOT NULL,
	"net_total" integer DEFAULT 0 NOT NULL,
	"tax_total" integer DEFAULT 0 NOT NULL,
	"gross_total" integer DEFAULT 0 NOT NULL,
	"discount_total" integer DEFAULT 0 NOT NULL,
	"header" text,
	"footer" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"converted_to_invoice_id" uuid,
	"reminder_level" integer DEFAULT 0 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" varchar(500),
	"cancelled_by_document_id" uuid,
	"cancels_document_id" uuid,
	"work_order_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminder_pdfs" (
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
CREATE TABLE IF NOT EXISTS "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" varchar(50) NOT NULL,
	"invoice_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"half_day" boolean DEFAULT false NOT NULL,
	"notes" text,
	"status" varchar(20) DEFAULT 'approved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attachment_mime" varchar(50),
	"attachment_name" varchar(200),
	"attachment_data" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_salary_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"monthly_salary" integer,
	"hourly_wage" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
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
CREATE TABLE IF NOT EXISTS "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"hours" numeric(6, 2) NOT NULL,
	"document_id" uuid,
	"customer_id" uuid,
	"task" varchar(200),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"work_order_id" uuid,
	"work_order_item_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workshop_hours" (
	"weekday" integer PRIMARY KEY NOT NULL,
	"opens_at" time DEFAULT '08:00:00' NOT NULL,
	"closes_at" time DEFAULT '17:00:00' NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"tables_processed" integer DEFAULT 0 NOT NULL,
	"rows_imported" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_label" varchar(200)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ebay_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ebay_username" varchar(100),
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token" text NOT NULL,
	"refresh_token_expires_at" timestamp with time zone,
	"scopes" text DEFAULT '' NOT NULL,
	"environment" varchar(20) DEFAULT 'production' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ebay_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"imported" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"ended" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"total_active" integer DEFAULT 0 NOT NULL,
	"error" text,
	"environment" varchar(20) DEFAULT 'production' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ebay_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ebay_item_id" varchar(30) NOT NULL,
	"sku" varchar(80),
	"title" varchar(255) NOT NULL,
	"price_value" integer,
	"price_currency" varchar(3),
	"quantity_available" integer,
	"quantity_sold" integer,
	"listing_type" varchar(30),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"view_item_url" text,
	"gallery_url" text,
	"picture_urls" jsonb DEFAULT '[]'::jsonb,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"environment" varchar(20) DEFAULT 'production' NOT NULL,
	"tire_id" uuid,
	"first_imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"default_tax_rate" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" varchar(50),
	"direction" varchar(10) NOT NULL,
	"entry_date" date NOT NULL,
	"amount_gross" integer NOT NULL,
	"amount_net" integer NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '19.00' NOT NULL,
	"category_id" uuid,
	"description" text NOT NULL,
	"payment_method" varchar(30),
	"payment_status" varchar(20) DEFAULT 'paid' NOT NULL,
	"supplier_id" uuid,
	"customer_id" uuid,
	"document_id" uuid,
	"source" varchar(30) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_order_assignees" (
	"work_order_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	CONSTRAINT "work_order_assignees_work_order_id_employee_id_pk" PRIMARY KEY("work_order_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" varchar(20) DEFAULT 'labor' NOT NULL,
	"item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit" varchar(20),
	"unit_price_net" integer NOT NULL,
	"employee_id" uuid,
	"hours" numeric(6, 2),
	"done_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"customer_id" uuid,
	"vehicle_id" uuid,
	"appointment_id" uuid,
	"invoice_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_date" date,
	"scheduled_time" varchar(5),
	CONSTRAINT "work_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_settings" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"small_business_exempt" boolean DEFAULT false NOT NULL,
	"reminder_auto_enabled" boolean DEFAULT true NOT NULL,
	"reminder_days_1" integer DEFAULT 3 NOT NULL,
	"reminder_recur_every_days" integer DEFAULT 14 NOT NULL,
	"geo_lat" numeric(9, 6),
	"geo_lon" numeric(9, 6),
	"labor_item_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "number_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(30) NOT NULL,
	"format_template" varchar(50) NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "number_ranges_kind_unique" UNIQUE("kind")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tire_reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"season" varchar(20) NOT NULL,
	"year" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tire_reminder_log_unique" UNIQUE("customer_id","season","year")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tire_storage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_number" varchar(50) NOT NULL,
	"customer_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"brand" varchar(80),
	"model" varchar(120),
	"size" varchar(40),
	"profile_mm" numeric(4, 1),
	"dot_year" integer,
	"season" varchar(20),
	"quantity" integer DEFAULT 4 NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"stored_at" date DEFAULT now() NOT NULL,
	"retrieved_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"note" varchar(500),
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_license_plate_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"license_plate" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'available' NOT NULL,
	"sales_price_gross" integer,
	"differential_tax" boolean DEFAULT false NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb,
	"highlights" text,
	"location" varchar(100),
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"mime" varchar(50) NOT NULL,
	"data_url" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"purchase_date" date NOT NULL,
	"purchase_price" integer NOT NULL,
	"previous_owner" varchar(200),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_id" uuid,
	"sale_date" date NOT NULL,
	"sales_price_gross" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"legacy_vehicle_id" varchar(50),
	"make" varchar(100),
	"model" varchar(150),
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_owner_customer_id" uuid
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "item_price_versions" ADD CONSTRAINT "item_price_versions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tire_photos" ADD CONSTRAINT "tire_photos_tire_id_fk" FOREIGN KEY ("tire_id") REFERENCES "public"."tires"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tire_price_versions" ADD CONSTRAINT "tire_price_versions_tire_id_fk" FOREIGN KEY ("tire_id") REFERENCES "public"."tires"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "customer_inquiries" ADD CONSTRAINT "customer_inquiries_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "document_items" ADD CONSTRAINT "document_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "document_items" ADD CONSTRAINT "document_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "document_items" ADD CONSTRAINT "document_items_tire_id_fk" FOREIGN KEY ("tire_id") REFERENCES "public"."tires"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "document_payments" ADD CONSTRAINT "document_payments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "document_pdfs" ADD CONSTRAINT "document_pdfs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_cancelled_by_fk" FOREIGN KEY ("cancelled_by_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_cancels_fk" FOREIGN KEY ("cancels_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "reminder_pdfs" ADD CONSTRAINT "reminder_pdfs_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_invoice_id_documents_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "employee_absences" ADD CONSTRAINT "employee_absences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "employee_salary_versions" ADD CONSTRAINT "employee_salary_versions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_work_order_item_id_work_order_items_id_fk" FOREIGN KEY ("work_order_item_id") REFERENCES "public"."work_order_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ebay_listings" ADD CONSTRAINT "ebay_listings_tire_id_tires_id_fk" FOREIGN KEY ("tire_id") REFERENCES "public"."tires"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_category_id_ledger_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ledger_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_order_assignees" ADD CONSTRAINT "work_order_assignees_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_order_assignees" ADD CONSTRAINT "work_order_assignees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_appointment_id_calendar_entries_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."calendar_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_invoice_id_documents_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_labor_item_id_items_id_fk" FOREIGN KEY ("labor_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tire_reminder_log" ADD CONSTRAINT "tire_reminder_log_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tire_storage" ADD CONSTRAINT "tire_storage_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tire_storage" ADD CONSTRAINT "tire_storage_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicle_license_plate_versions" ADD CONSTRAINT "vehicle_license_plate_versions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicle_purchases" ADD CONSTRAINT "vehicle_purchases_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicle_sales" ADD CONSTRAINT "vehicle_sales_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicle_sales" ADD CONSTRAINT "vehicle_sales_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicle_sales" ADD CONSTRAINT "vehicle_sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_previous_owner_customer_id_customers_id_fk" FOREIGN KEY ("previous_owner_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_idx" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_role_id_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_entries_customer_id_idx" ON "calendar_entries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_entries_employee_id_idx" ON "calendar_entries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_entries_vehicle_id_idx" ON "calendar_entries" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_entries_kind_idx" ON "calendar_entries" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_entries_starts_at_idx" ON "calendar_entries" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "item_price_versions_item_from_idx" ON "item_price_versions" USING btree ("item_id","valid_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_price_versions_item_idx" ON "item_price_versions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_created_at_idx" ON "items" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "items_article_number_idx" ON "items" USING btree ("article_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_kind_idx" ON "items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tire_photos_tire_idx" ON "tire_photos" USING btree ("tire_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tire_price_versions_tire_from_idx" ON "tire_price_versions" USING btree ("tire_id","valid_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tires_created_at_idx" ON "tires" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tires_article_number_idx" ON "tires" USING btree ("article_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tires_brand_idx" ON "tires" USING btree ("brand");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tires_online_sellable_idx" ON "tires" USING btree ("online_sellable");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tires_season_idx" ON "tires" USING btree ("season");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tires_size_idx" ON "tires" USING btree ("width","aspect_ratio","diameter_inch");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_templates_key_idx" ON "mail_templates" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_published_idx" ON "posts" USING btree ("published","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sent_messages_document_id_idx" ON "sent_messages" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sent_messages_sent_at_idx" ON "sent_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "smtp_settings_singleton" ON "smtp_settings" USING btree (((true)));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_inquiries_customer_id_idx" ON "customer_inquiries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_inquiries_created_at_idx" ON "customer_inquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_inquiries_notification_status_idx" ON "customer_inquiries" USING btree ("notification_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_inquiries_status_idx" ON "customer_inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_created_at_idx" ON "customers" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_company_idx" ON "customers" USING btree ("company");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_customer_number_idx" ON "customers" USING btree ("customer_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_kind_idx" ON "customers" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_last_name_idx" ON "customers" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_wants_broadcast_idx" ON "customers" USING btree ("wants_broadcast");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_zip_idx" ON "customers" USING btree ("zip");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_created_at_idx" ON "suppliers" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_items_document_id_idx" ON "document_items" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_items_item_id_idx" ON "document_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_items_tire_idx" ON "document_items" USING btree ("tire_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_payments_document_id_idx" ON "document_payments" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_pdfs_document_id_idx" ON "document_pdfs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_created_at_idx" ON "documents" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_vehicle_id_idx" ON "documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_cancelled_by_idx" ON "documents" USING btree ("cancelled_by_document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_cancels_idx" ON "documents" USING btree ("cancels_document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_converted_to_invoice_idx" ON "documents" USING btree ("converted_to_invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_customer_id_idx" ON "documents" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_document_number_idx" ON "documents" USING btree ("document_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_issue_date_idx" ON "documents" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_type_status_idx" ON "documents" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_work_order_id_idx" ON "documents" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reminder_pdfs_reminder_id_idx" ON "reminder_pdfs" USING btree ("reminder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminders_invoice_id_idx" ON "reminders" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reminders_invoice_level_idx" ON "reminders" USING btree ("invoice_id","level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminders_status_idx" ON "reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_absences_date_from_idx" ON "employee_absences" USING btree ("date_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_absences_employee_id_idx" ON "employee_absences" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employee_salary_versions_emp_from_idx" ON "employee_salary_versions" USING btree ("employee_id","valid_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_salary_versions_employee_idx" ON "employee_salary_versions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_created_at_idx" ON "employees" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employees_personnel_number_idx" ON "employees" USING btree ("personnel_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_customer_id_idx" ON "time_entries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_date_idx" ON "time_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_document_id_idx" ON "time_entries" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_employee_id_idx" ON "time_entries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entries_work_order_id_idx" ON "time_entries" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_work_order_item_id_idx" ON "time_entries" USING btree ("work_order_item_id") WHERE (work_order_item_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ebay_credentials_singleton" ON "ebay_credentials" USING btree (((true)));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ebay_listings_tire_id_idx" ON "ebay_listings" USING btree ("tire_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ebay_listings_env_item_idx" ON "ebay_listings" USING btree ("environment","ebay_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ebay_listings_status_idx" ON "ebay_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_customer_id_idx" ON "ledger_entries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_document_id_idx" ON "ledger_entries" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_supplier_id_idx" ON "ledger_entries" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_category_id_idx" ON "ledger_entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_direction_idx" ON "ledger_entries" USING btree ("direction");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_entry_date_idx" ON "ledger_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_order_assignees_employee_id_idx" ON "work_order_assignees" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_order_items_employee_id_idx" ON "work_order_items" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_order_items_item_id_idx" ON "work_order_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_order_items_work_order_id_idx" ON "work_order_items" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_created_at_idx" ON "work_orders" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_vehicle_id_idx" ON "work_orders" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "work_orders_appointment_id_idx" ON "work_orders" USING btree ("appointment_id") WHERE (appointment_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_customer_id_idx" ON "work_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_invoice_id_idx" ON "work_orders" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_status_idx" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_settings_singleton" ON "company_settings" USING btree (((true)));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_settings_labor_item_id_idx" ON "company_settings" USING btree ("labor_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tire_reminder_log_customer_id_idx" ON "tire_reminder_log" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tire_reminder_log_season_year_idx" ON "tire_reminder_log" USING btree ("season","year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tire_storage_vehicle_id_idx" ON "tire_storage" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tire_storage_active_idx" ON "tire_storage" USING btree ("retrieved_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tire_storage_customer_id_idx" ON "tire_storage" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tire_storage_storage_number_idx" ON "tire_storage" USING btree ("storage_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_documents_vehicle_id_idx" ON "vehicle_documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_license_plate_versions_plate_idx" ON "vehicle_license_plate_versions" USING btree ("license_plate");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_license_plate_versions_veh_from_idx" ON "vehicle_license_plate_versions" USING btree ("vehicle_id","valid_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_license_plate_versions_vehicle_idx" ON "vehicle_license_plate_versions" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_listings_vehicle_unique" ON "vehicle_listings" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_photos_vehicle_id_idx" ON "vehicle_photos" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_purchases_vehicle_id_idx" ON "vehicle_purchases" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_sales_invoice_id_idx" ON "vehicle_sales" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_sales_customer_id_idx" ON "vehicle_sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_sales_vehicle_id_idx" ON "vehicle_sales" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_created_at_idx" ON "vehicles" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_previous_owner_customer_id_idx" ON "vehicles" USING btree ("previous_owner_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_customer_id_idx" ON "vehicles" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_next_hu_idx" ON "vehicles" USING btree ("next_hu");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_vin_idx" ON "vehicles" USING btree ("vin");