-- Shop refocus: TwinCast's only physical product line is tires. Remove the
-- general-shop stock-planning fields (Mindestbestand / Sollbestand) and the
-- Auslaufartikel flag from both `items` (workshop services/materials) and
-- `tires`. Tire shop visibility is governed solely by `online_sellable`;
-- retired catalog rows are simply deleted rather than flagged. Actual
-- on-hand stock (`stock_on_hand`) stays — it still matters for eBay sync and
-- local overview.
ALTER TABLE "items" DROP COLUMN IF EXISTS "stock_min";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN IF EXISTS "stock_max";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN IF EXISTS "discontinued";--> statement-breakpoint
ALTER TABLE "tires" DROP COLUMN IF EXISTS "stock_min";--> statement-breakpoint
ALTER TABLE "tires" DROP COLUMN IF EXISTS "stock_max";--> statement-breakpoint
ALTER TABLE "tires" DROP COLUMN IF EXISTS "discontinued";
