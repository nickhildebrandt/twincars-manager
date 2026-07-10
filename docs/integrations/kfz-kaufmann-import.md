---
title: Integration - KFZ-Kaufmann import (legacy Access MDB)
tags: [integration, import, legacy, mdb]
updated: 2026-07-10
---

# KFZ-Kaufmann import

One-shot migration of the legacy Access database (`.mdb`) into Postgres.
Implementation: `src/lib/server/services/import-service.ts` (~1000+
lines); UI wrapper: [[import]]. Requires **mdbtools** (`mdb-export`) on
the host / in the container. Test corpus:
`/home/nick/tc/Daten/kfz-kaufmann-test.mdb` (18 MB, ~87k rows).

## Pipeline

1. Write the uploaded MDB to a temp dir.
2. `mdb-export -d ';' -D '%Y-%m-%d %H:%M:%S'` per table, CSV-parsed
   (csv-parse).
3. **All 13 tables are read FIRST** - a corrupt MDB fails before
   anything is deleted ([[adr-004-import-wipe-first-read-before-wipe]]).
4. Wipe business tables (settings/templates/number ranges/ledger
   categories survive). Skipped entirely in dry-run.
5. Map + batch-insert; render PDFs (~10.5k on the real data; skipped in
   dry-run); set `number_ranges.next_value = max(legacy)+1` (legal
   number continuity).
6. Write/update the `access_import_jobs` audit row throughout
   (running → completed/failed, live `progress`/`progressLabel` for the
   UI bar, counts, notes) - even on mid-run throw.

## Table mapping (legacy → new)

| MDB table                     | Target                      | Notes                                                                                                                                                                                                                                                                             |
| ----------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Kunden`                      | `customers`                 | `Kunden-Nr` → `legacyCustomerNumber`; rows without Kunden-Nr skipped with reason; `kind` = `ebay` when `isEbayCustomerName` matches, else `regular` (see rule below)                                                                                                              |
| `Autos`                       | `vehicles`                  | all as customer vehicles; holder resolved via Kunden-Nr; `id_auto` map kept for reifenlager                                                                                                                                                                                       |
| `Lieferanten`                 | `suppliers`                 | `Kundennummer` → `customerNumberAtSupplier`                                                                                                                                                                                                                                       |
| `Artikel`                     | `items`                     | tire articles currently land in `items` too (routing them into `tires` is an open backlog item)                                                                                                                                                                                   |
| `Rechnungen`                  | `documents` (invoice)       | status paid/cancelled; header taxRate from `MWSteuer` (default 19); `inkl=true` means gross, net is back-computed; missing dates get fallbacks                                                                                                                                    |
| `RechnungDetails`             | `document_items`            | tax per line = the DOCUMENT header rate (was wrongly hardcoded 19 %); positions without importable invoice are skipped with reason                                                                                                                                                |
| `Angebote` / `AngebotDetails` | `documents` (offer) + items | column is `Angebotsnummer` (capital A - a lowercase read once silently dropped ALL 1711 positions); orphan positions collect under a lazily-created "Sammel-Angebot" `AN-IMPORT-SAMMEL-<year>` with summed totals                                                                 |
| `Mahnungen`                   | `reminders`                 | reminder without date skipped with reason                                                                                                                                                                                                                                         |
| `Teilzahlungen`               | `document_payments`         | rows without date/amount skipped with reason                                                                                                                                                                                                                                      |
| `reifenlager`                 | `tire_storage`              | `idkunde` = Kunden-Nr (verified); `id_auto` via vehicle map; `nummer` → storageNumber (null → generated, duplicates suffixed); `grösse` → size; `art` → season; min(vl/vr/hl/hr) → profileMm; `annahmedatum` → storedAt (fallback 1900-01-01); zustand/felge/lagerort/DOT → notes |
| `mitarbeiter`                 | `employees`                 | `kuerzel` → personnelNumber (fallback `MA-{n}`); missing names get placeholder                                                                                                                                                                                                    |
| `termine`                     | `calendar_entries`          | datum+uhrzeit → startsAt; uhrzeitbis/+1h/end-of-day → endsAt; no time → allDay; kind=appointment; past → completed                                                                                                                                                                |

## Rules and quirks (hard-won)

- **No silent drops**: every skipped row is recorded
  (`skippedDetail: {table, legacyKey, reason}[]`, capped at 1000
  entries; aggregate counts stay exact). Result modal shows the drop
  table.
- **Zero-header totals backfill**: ~73 % of legacy invoices carry NO
  header total - totals are recomputed from line items; header totals
  that ARE present win. Same backfill for offers. (The "€0 imported
  invoices" bug class lives here - re-verify after mapping changes.)
- **Legacy dates are dirty**: parser handles `0297-20-01`-style
  month-20 garbage, `MM.YYYY`, `MM-YY`, `DD.MM.YYYY` (see
  `__transforms` tests).
- **eBay customer detection** (2026-07): `isEbayCustomerName` in
  `src/lib/utils/ebay-detection.ts` - a customer whose legacy `Name`,
  `Firma`, `Vorname` or `Nachname` contains the substring "ebay"
  anywhere, case-insensitively (fields checked independently, never
  combined across fields), is imported with `customers.kind = 'ebay'`;
  everyone else `'regular'`. Applied EXCLUSIVELY in this import
  mapping; nothing at runtime derives `kind` from names, and existing
  rows are never rewritten. Documented edge cases: "Bayer" no,
  "Ebayer" / "Sebayn" yes; false positives of the "Sebayn" kind are
  accepted (the operator flips the Kundenart on the customer form),
  whereas a missed eBay buyer would silently pollute the regular
  customer base.
- Documents reference no vehicle in the MDB → `documents.vehicle_id`
  stays NULL.
- Imported documents are `paid` (or `cancelled` for "storniert") and do
  NOT appear in [[sent]].
- Not fully transactional by design: wipe-first means a failed run
  self-heals on re-run ([[adr-004-import-wipe-first-read-before-wipe]]).
- **Dry-run** (`importMdb(buffer, { dryRun: true })`) parses, maps,
  validates and returns the full summary WITHOUT wipe/insert/number
  ranges/PDFs/audit row.
- Upload path needs `BODY_SIZE_LIMIT=64M` (base64 MDB ~25 MB).
- `Bestandskorrektur=true` invoice numbers are surfaced in the summary.

## Tests

`import-service.test.ts`: transform-helper units (dates, status/type/
season mapping, make/model split) + a full pipeline E2E through a mocked
`mdb-export` exec boundary (mapping, read-before-wipe, skip report,
dry-run writes nothing). Historic detail:
`archive/twincast-production-plan.md` P1.5.
