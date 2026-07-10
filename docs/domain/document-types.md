---
title: Beleg types (document types)
tags: [domain, documents, billing]
updated: 2026-07-10
---

# Beleg types

All billing documents share one table (`documents`) discriminated by
`type`. Canonical values (see `src/lib/server/db/validation.ts` and
`document-service.ts`):

| `type`               | German UI                | Notes                                                                                                                  |
| -------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `invoice`            | Rechnung                 | The only type that can be paid, reminded, cancelled (Storno), exported to [[xrechnung]] / [[datev]].                   |
| `offer`              | Angebot                  | Convertible to invoice via `convertOfferToInvoice`; status flips to `converted`, `convertedToInvoiceId` links forward. |
| `cost_estimate`      | Kostenvoranschlag (KV)   | Same offer lifecycle.                                                                                                  |
| `order_confirmation` | Auftragsbestätigung (AB) | Same offer lifecycle.                                                                                                  |

A **Storno-Rechnung** is not a separate type: it is `type='invoice'`,
`status='storno'`, with negated totals and `cancelsDocumentId` pointing at
the original ([[adr-015-storno-instead-of-delete]]). Its number comes from
the `storno` number range (`S-{N}`).

**Zahlungserinnerungen** live in their own `reminders` table with their own
number range `ZE-{YYYY}-{NNNN}` - deliberately NOT in `documents`
(different lifecycle, single friendly template, `level` counter). See
[[reminders]].

## Status values

- Invoices: `created` → `paid` (via `document_payments` covering the gross
  total) or `cancelled`/`storno` chain; `reminderLevel` counts sent
  Zahlungserinnerungen. Invoices billing a work order additionally
  follow the order ↔ invoice rule set (`documents.work_order_id`,
  auto-reopen on Storno) - [[order-invoice-rules]].
- Offers/KV/AB: `created` → `converted` (or cancelled). The offer detail
  page offers "In Rechnung umwandeln" (`/offers/[id]/convert`).
- Reminders: `open` → `sent` → `paid` / `cancelled`.

## Numbers

`number_ranges.formatTemplate` per kind; plain `{N}` for
invoice/offer/KV/AB/customer (continuing the legacy sequence after an
import - `next_value` is set to max(legacy)+1), `ZE-{YYYY}-{NNNN}` for
reminders, `L-{YYYY}-{NNNN}` for tire storage, `S-{N}` for storno.
Number allocation is race-safe via `number-range-service.ts` (atomic
`UPDATE ... RETURNING`), the GoBD guarantee against duplicate numbers.
`legacyDocumentNumber` keeps the original Kfz-Kaufmann number.

## Line items and totals

`document_items` rows are **snapshots** (unitPriceNet, taxRate,
discountPercent, lineTotal\*) - never joined back to catalog prices
([[adr-007-price-snapshots-and-versions]]). Positions can back-link to
`items` (`itemId`) or `tires` (`tireId`) for navigation only. Header
totals (`netTotal`, `taxTotal`, `grossTotal`, `discountTotal`) are stored
on the document. The legacy import backfills zero header totals from line
sums because ~73 % of legacy invoices carried no header total
([[kfz-kaufmann-import]]).

Related: [[invoices]], [[offers]], [[order-invoice-rules]],
[[pdf-pipeline]], [[sales-ledger]].
