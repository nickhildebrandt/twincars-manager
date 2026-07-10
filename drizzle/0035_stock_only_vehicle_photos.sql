-- Stock-vehicle-only photo invariant (requirement 6): vehicle photos
-- are listing artifacts and exist only for stock vehicles
-- (customer_id IS NULL). The application now rejects photo uploads on
-- customer-owned vehicles and deletes the gallery when a stock
-- vehicle is sold. This cleans up rows that pre-date the rule.
-- Idempotent: re-running deletes nothing.
DELETE FROM "vehicle_photos"
WHERE "vehicle_id" IN (
  SELECT "id" FROM "vehicles" WHERE "customer_id" IS NOT NULL
);
