-- Migration 0009: Versionierte Kennzeichenhistorie pro Fahrzeug. Wenn
-- ein Halter ein neues Kennzeichen bekommt (Umzug, Verkauf, Wunsch),
-- darf das alte Kennzeichen die historischen Belege nicht verändern —
-- daher analog zu Preis- und Gehalts-Versionierung eine eigene Tabelle.

CREATE TABLE IF NOT EXISTS "vehicle_license_plate_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vehicle_id" uuid NOT NULL,
  "valid_from" date NOT NULL,
  "license_plate" varchar(20) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "vehicle_license_plate_versions"
    ADD CONSTRAINT "vehicle_license_plate_versions_vehicle_id_vehicles_id_fk"
    FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_license_plate_versions_veh_from_idx"
  ON "vehicle_license_plate_versions" USING btree
  ("vehicle_id", "valid_from");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_license_plate_versions_vehicle_idx"
  ON "vehicle_license_plate_versions" USING btree ("vehicle_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_license_plate_versions_plate_idx"
  ON "vehicle_license_plate_versions" USING btree ("license_plate");
--> statement-breakpoint

-- Backfill: aktuelle `vehicles.license_plate` zur Erstanlage als
-- Version übernehmen. `valid_from` = `first_registration` falls
-- gesetzt, sonst `created_at::date`.
INSERT INTO "vehicle_license_plate_versions"
  ("vehicle_id", "valid_from", "license_plate", "created_at")
SELECT
  v."id",
  COALESCE(v."first_registration", v."created_at"::date),
  v."license_plate",
  v."created_at"
FROM "vehicles" v
WHERE v."license_plate" IS NOT NULL AND v."license_plate" <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "vehicle_license_plate_versions" pv
    WHERE pv."vehicle_id" = v."id"
  );
--> statement-breakpoint

-- Index auf der Stamm-Spalte droppen, dann Spalte selbst — Lesepfade
-- gehen jetzt über den Service-Helper.
DROP INDEX IF EXISTS "vehicles_license_plate_idx";
--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "license_plate";
