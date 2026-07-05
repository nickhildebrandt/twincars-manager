---
title: Database schema overview
tags: [architecture, database, drizzle, postgres]
updated: 2026-07-05
---

# Database schema overview

PostgreSQL (>= 14 dev, 18-alpine in prod) + Drizzle ORM. Single schema file
`src/lib/server/db/schema.ts`; migrations in `drizzle/` (0000..0031 as of
2026-07-05). Migrations run OUTSIDE the request lifecycle: `scripts/migrate.js`
before `node build` (Dockerfile CMD), `pnpm db:migrate` in dev. Hand-edit
generated SQL to be idempotent (`IF NOT EXISTS`, `DO $$ ... EXCEPTION`
blocks) per `CONTRIBUTING.md` §17. Tests run against **pg-mem** (the whole
migration chain is applied in the suite), so no live Postgres is needed.

## Table groups

### App settings

`company_settings` (single row; `setupCompleted` gate, reminder defaults
`reminderAutoEnabled`/`reminderDays1=3`/`reminderRecurEveryDays=14`,
`smallBusinessExempt`, geoLat/Lon, logo inline), `smtp_settings`,
`number_ranges` (kind unique: invoice, offer, cost_estimate,
order_confirmation, reminder, customer, tire_storage, storno),
`mail_templates` (key unique, `isCustom` marks operator edits).

### Customers & vehicles

`customers` (kind `regular`|`ebay`, `wantsBroadcast`, `wantsTireReminders`,
archived), `vehicles` (customer + stock; plate NOT on the table),
`vehicle_license_plate_versions` (versioned plates),
`vehicle_purchases`, `vehicle_listings` (status, salesPriceGross,
`differentialTax`, equipment jsonb), `vehicle_photos` (base64 dataUrl,
isMain, sortOrder), `vehicle_sales`.

### Catalog

`items` (kind, purchasePriceNet, stockOnHand, `onlineBookable`; NO
unit_price_net since 0008, NO discontinued/stockMin/stockMax since 0026 -
[[adr-016-shop-refocus]]), `item_price_versions`, `suppliers`,
`tires` (typed EU-label columns, `onlineSellable`, shippingOptionId),
`tire_price_versions`, `tire_photos`, `shipping_options`.

### Documents & billing

`documents` (shared model, [[document-types]]; storno FK pair set by raw
SQL in the migration, not `.references()`), `document_items` (snapshots +
optional itemId/tireId back-links), `document_payments`, `document_pdfs`
(bytea + inputHash cache, [[pdf-pipeline]]), `reminders`,
`reminder_pdfs`, `sent_messages` (audit of every mail, [[sent]]).

### People & time

`employees`, `employee_salary_versions`, `employee_absences`,
`time_entries` (hours as numeric effort), `workshop_hours` (weekday PK
0=Sunday..6=Saturday, opensAt/closesAt/closed).

### Calendar

`calendar_entries` (kind `appointment`|`closure`,
[[adr-011-unified-calendar-entries]]), `public_holidays`.

### Ledger

`ledger_categories` (seeded), `ledger_entries` (direction, gross/net/tax,
paymentMethod, source, FK to category/supplier/customer/document),
`recurring_entries` (interval templates with nextRunDate/paused).

### Web / integration

`posts` (slug unique, published index, cover jsonb),
`customer_inquiries` (contact form + notificationStatus
pending/sent/failed), `access_import_jobs` (status, progress 0-100 +
progressLabel for the live import bar, row counts, notes),
`tire_storage`, `tire_reminder_log` (unique customer+season+year),
`ebay_credentials` (single-row semantics, AES-256-GCM encrypted tokens,
environment production|sandbox).

### Auth (better-auth + RBAC overlay)

`users` (text id, synthesized email, username unique, `active`),
`sessions`, `accounts` (bcrypt password for credential provider),
`verifications`, `roles`, `user_roles`, `role_permissions` (permission
strings, wildcard `*`).

## Cross-cutting conventions

- **Versioned master values** (`*_versions` tables): one row per
  `valid_from`; the active version is max(valid_from <= date). Used by
  `item_price_versions`, `tire_price_versions`,
  `employee_salary_versions`, `vehicle_license_plate_versions`.
  Documents keep their own snapshots so history never changes
  ([[adr-007-price-snapshots-and-versions]]).
- **Binary data in Postgres**: PDFs as `bytea` with a content hash
  ([[adr-006-pdfs-in-postgres]]); images as base64 text/jsonb inline
  (single-tenant, no object storage).
- **Soft delete** via `archived` on customers/vehicles/suppliers/
  employees; hard delete elsewhere; invoices never deleted
  ([[adr-015-storno-instead-of-delete]]).
- **Legacy keys**: `legacy*` columns keep Kfz-Kaufmann identifiers for
  traceability ([[kfz-kaufmann-import]]).

## Migration ledger highlights

0005 unified calendar entries · 0008 versioned prices/salaries ·
0009 versioned plates · 0010 better-auth + RBAC · 0012 time tracking ·
0015 payroll removed · 0020 invoice storno · 0022 dedicated tires table ·
0024 simplified reminders · 0025 API-token table dropped (env-based,
[[adr-010-api-tokens-in-env]]) · 0026 shop refocus drop stock fields ·
0027 users.active · 0028 items.onlineBookable · 0029 posts ·
0030 ebay_credentials · 0031 import job progress.
