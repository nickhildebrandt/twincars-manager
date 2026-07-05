-- Remove the Versandoptionen (shipping options) module entirely:
-- the storefront never used paid shipping in practice, so the table,
-- the tires back-link and the `shipping` permission all go away.
-- The public orders endpoint keeps emitting `shippingNet: 0` for
-- wire compatibility; see `src/routes/api/public/orders/endpoint.ts`.
ALTER TABLE "tires" DROP CONSTRAINT IF EXISTS "tires_shipping_option_id_fk";
--> statement-breakpoint
ALTER TABLE "tires" DROP COLUMN IF EXISTS "shipping_option_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "shipping_options";
--> statement-breakpoint
DELETE FROM "role_permissions" WHERE "permission" = 'shipping';
