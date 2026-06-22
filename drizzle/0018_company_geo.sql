-- Migration 0018: optional geo coordinates on company settings.
--
-- The public `GET /api/public/company` endpoint exposes the workshop's
-- address plus, when configured, latitude/longitude so the external
-- website can render a map. Both columns are nullable — the setup
-- wizard can leave them empty without breaking anything else.

ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "geo_lat" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "geo_lon" numeric(9, 6);
