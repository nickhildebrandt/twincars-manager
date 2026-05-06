-- Migration 0008: Versionierte Preise (item_price_versions) und Gehälter
-- (employee_salary_versions). Übergangs-Plan:
--   1. Neue Tabellen anlegen
--   2. Vorhandene Werte aus `employees`/`items` als initiale Version
--      mit `valid_from` = Einstellungs-/Anlagedatum übernehmen
--   3. Die nun redundanten Stammspalten droppen
-- Nach der Migration sprechen Service-Helper (`getEffectiveSalary`,
-- `getCurrentItemPrice`) ausschliesslich gegen die Versionstabellen.

CREATE TABLE IF NOT EXISTS "employee_salary_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "valid_from" date NOT NULL,
  "monthly_salary" numeric(12, 2),
  "hourly_wage" numeric(8, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "employee_salary_versions"
    ADD CONSTRAINT "employee_salary_versions_employee_id_employees_id_fk"
    FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "employee_salary_versions_emp_from_idx"
  ON "employee_salary_versions" USING btree ("employee_id", "valid_from");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_salary_versions_employee_idx"
  ON "employee_salary_versions" USING btree ("employee_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "item_price_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid NOT NULL,
  "valid_from" date NOT NULL,
  "unit_price_net" numeric(12, 2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "item_price_versions"
    ADD CONSTRAINT "item_price_versions_item_id_items_id_fk"
    FOREIGN KEY ("item_id") REFERENCES "public"."items"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "item_price_versions_item_from_idx"
  ON "item_price_versions" USING btree ("item_id", "valid_from");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_price_versions_item_idx"
  ON "item_price_versions" USING btree ("item_id");
--> statement-breakpoint

-- Backfill: jeweils erste Version pro Mitarbeiter aus den
-- Stammdaten ableiten. Wir nehmen `hire_date` als Gültigkeits-Beginn,
-- weil Lohnabrechnungen vor diesem Datum sowieso nicht existieren.
-- Fällt `hire_date` aus, zieht `created_at::date` als Fallback.
INSERT INTO "employee_salary_versions"
  ("employee_id", "valid_from", "monthly_salary", "hourly_wage", "created_at")
SELECT
  e."id",
  COALESCE(e."hire_date", e."created_at"::date) AS valid_from,
  e."monthly_salary",
  e."hourly_wage",
  e."created_at"
FROM "employees" e
WHERE (e."monthly_salary" IS NOT NULL OR e."hourly_wage" IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "employee_salary_versions" v
    WHERE v."employee_id" = e."id"
  );
--> statement-breakpoint

-- Backfill Items: aktuelle `unit_price_net` zum Anlagedatum als Version 0.
INSERT INTO "item_price_versions"
  ("item_id", "valid_from", "unit_price_net", "created_at")
SELECT
  i."id",
  i."created_at"::date AS valid_from,
  COALESCE(i."unit_price_net", 0),
  i."created_at"
FROM "items" i
WHERE NOT EXISTS (
  SELECT 1 FROM "item_price_versions" v WHERE v."item_id" = i."id"
);
--> statement-breakpoint

-- Stammspalten droppen, sobald der Backfill durch ist. `IF EXISTS`
-- schützt gegen wiederholtes Ausführen.
ALTER TABLE "employees" DROP COLUMN IF EXISTS "monthly_salary";
--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN IF EXISTS "hourly_wage";
--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN IF EXISTS "unit_price_net";
