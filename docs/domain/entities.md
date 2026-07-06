---
title: Entity map
tags: [domain, entities, schema]
updated: 2026-07-06
---

# Entity map

The core domain entities and how they relate. Table-level detail lives in
[[database-schema]]; per-module behavior in the module notes.

## Kunde (customer) - `customers`

Central party record. `customerNumber` (unique, from the `customer` number
range), `legacyCustomerNumber` (Kfz-Kaufmann "Kunden-Nr"), name/company,
address, contact, bank data, `paymentTermDays` override. Discriminator
`kind`: `regular` | `ebay` (eBay marketplace buyers carry only
`ebayHandle`). Opt-in flags `wantsBroadcast` (Rundschreiben) and
`wantsTireReminders` (seasonal tire mails). Soft delete via `archived`.
Module: [[customers]].

## Fahrzeug (vehicle) - `vehicles`

One table for BOTH customer vehicles and stock (used-car) vehicles.
`customerId` nullable (stock vehicles may have none); optional
`previousOwnerCustomerId` names the Vorbesitzer of a stock vehicle. VIN,
HSN/TSN, HU/AU dates, technical data (`fuelType`, `gearbox`,
`displacementCcm`, `powerKw`, `colorCode`, `bodyType`). The license
plate is **versioned** in `vehicle_license_plate_versions` (plate
changes never alter history). File attachments (Fahrzeugschein etc.)
live in `vehicle_documents` (bytea inline, meta-only list reads). Stock
lifecycle adds `vehicle_purchases`, `vehicle_listings` (status,
`salesPriceGross`, `differentialTax`, equipment JSON), `vehicle_photos`
and `vehicle_sales`. Modules: [[vehicles]], [[inventory]].

## Beleg (document) - `documents` + `document_items` + `document_payments`

Shared model for all billing documents; discriminated by `type`
(see [[document-types]]). Line items snapshot price/tax/discount
([[adr-007-price-snapshots-and-versions]]). Payments are separate rows.
PDFs cached in `document_pdfs` ([[pdf-pipeline]]). Storno chaining via
`cancelledByDocumentId` / `cancelsDocumentId`
([[adr-015-storno-instead-of-delete]]). Modules: [[invoices]], [[offers]].

## Zahlungserinnerung (payment reminder) - `reminders` + `reminder_pdfs`

Own table and number range (`ZE-{YYYY}-{NNNN}`), NOT part of `documents`.
`level` counts sends (1, 2, ...) but every level uses the same friendly
template. Module: [[reminders]].

## Leistung / Material / Artikel - `items`

Catalog of workshop services and articles. `kind`: `service` | `material` |
`article` | (Durchlaufposten). Sales price is versioned in
`item_price_versions` (no `unit_price_net` column since migration 0008).
`onlineBookable` gates the public appointment API (tire-change services).
Module: [[items]].

## Reifen (tire) - `tires` + `tire_price_versions` + `tire_photos`

Dedicated tire SKU table (replaces the earlier `items.kind='tire'` JSONB
approach): typed columns for size (width/aspectRatio/diameterInch),
`construction` R|D, `loadIndex`, `speedIndex`, `season`
(`Sommer`|`Winter`|`Ganzjahres`), EAN, EU-label fields (fuelEfficiency,
wetGrip, noiseClass/Db), flags (runFlat, reinforced, studdedWinter,
mSMarking, snowFlake, evCertified), `stockOnHand`, `onlineSellable`
(the only public/shop visibility gate - see [[adr-016-shop-refocus]]).
Module: [[tires]].

## Reifeneinlagerung (tire storage) - `tire_storage`

Customer-owned tire sets stored at the workshop. `storageNumber` (unique,
number range `L-{YYYY}-{NNNN}`), customer FK (restrict), optional vehicle
FK, brand/size/profileMm/dotYear/season (`summer`|`winter`|`allseason`),
`quantity`, inline photos JSON, `storedAt`, `retrievedAt` (null = still
stored). QR label deep-links to `/tire-storage/scan/<number>`.
Module: [[tire-storage]].

## Mitarbeiter (employee) - `employees`

HR master data incl. tax/social insurance/bank fields,
`vacationDaysPerYear`. Salaries versioned in `employee_salary_versions`
(`getEffectiveSalary`). Absences in `employee_absences`
(`vacation`|`sick`|`other`, optional attachment). Time logging in
`time_entries` (effort in hours, not punch-clock). Modules: [[employees]],
[[hours]]. Note: a richer vacation model (carryover, workday service) is
designed but NOT implemented - `archive/specs/2026-06-23-employee-absences-vacation-design.md`.

## Kalender - `calendar_entries` + `public_holidays`

Single table discriminated by `kind`: `appointment` (customer/vehicle/
employee links, status) | `closure` (Betriebsschließung, forced allDay).
See [[adr-011-unified-calendar-entries]]. Module: [[calendar]].

## Auftrag (work order) - `work_orders` + `work_order_assignees` + `work_order_items`

Workshop job from intake to invoice. `orderNumber` (unique, number range
`work_order`, `AU-{YYYY}-{NNNN}`), title (auto-composed from customer +
vehicle until manually edited), status `open` | `in_progress` | `done`
(Kanban), customer/vehicle links (each optional, at least one required),
`appointmentId` backlink to the source Termin (one order per Termin),
`invoiceId` set on completion, `scheduledDate` + optional
`scheduledTime` (HH:MM) for calendar placement. Assignees are m:n to
`employees`. Work items (`labor` | `material`) snapshot their net price
at entry time ([[adr-007-price-snapshots-and-versions]]); labor items
with employee + hours write through to `time_entries` ([[hours]]).
Completion creates the invoice from the items via the shared document
pipeline ([[invoices]]); labor positions carry the executing employee as
"(ausgeführt von NAME)". Module: [[orders]].

## Buchhaltung - `ledger_entries` + `ledger_categories` + `recurring_entries`

Income/expense ledger with categories (seeded), recurring templates and
document/customer/supplier back-links. Modules: [[ledger]],
[[sales-ledger]] (the read-only "Rechnungsausgangsbuch" view over
`documents`). Export: [[datev]].

## Lieferant (supplier) - `suppliers`

Master data with `legacySupplierNumber`, bank, `archived`. Module:
[[suppliers]].

## Post ("Aktuelle Informationen") - `posts`

News articles for the website: unique `slug`, `excerpt`, body, inline
cover image, `published`/`publishedAt`. Module: [[posts]];
public surface in [[public-rest-api]].

## Supporting entities

- `company_settings` - single-row app settings incl. `setupCompleted`
  gate ([[setup]]), reminder defaults, geo coordinates, logo,
  `laborItemId` (the "Arbeitszeit" item behind the workshop labor rate).
- `smtp_settings`, `mail_templates`, `sent_messages` - [[smtp-mail]], [[sent]].
- `number_ranges` - `invoice`, `offer`, `cost_estimate`,
  `order_confirmation`, `reminder`, `customer`, `tire_storage`, `storno`,
  `work_order`.
- `customer_inquiries` - public contact-form submissions with internal
  notification status (see [[public-rest-api]], [[settings]]).
- `access_import_jobs` - import audit rows with live progress
  ([[kfz-kaufmann-import]]).
- `tire_reminder_log` - idempotency log for seasonal tire mails.
- `workshop_hours` - opening hours per weekday, drives free-slot booking.
- `ebay_credentials` - encrypted OAuth tokens ([[ebay]]).
- `users`, `sessions`, `accounts`, `verifications`, `roles`, `user_roles`,
  `role_permissions` - [[auth-and-permissions]].
