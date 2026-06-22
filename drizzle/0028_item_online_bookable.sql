-- Online-bookable services: only services flagged here are bookable via
-- the public appointment API (TwinCast: tire-change). Existing rows
-- default to NOT bookable so nothing becomes online-bookable implicitly.
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "online_bookable" boolean DEFAULT false NOT NULL;
