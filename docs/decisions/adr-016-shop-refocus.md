---
title: ADR-016 - Shop refocus - drop discontinued/stockMin/stockMax
tags: [adr, items, tires, shop]
updated: 2026-07-05
---

# ADR-016: Shop refocus

**Status**: accepted 2026-06-22 (binding direction decision), shipped as
migration 0026.

## Context

`items` and `tires` carried `discontinued` (Auslaufartikel), `stockMin`
and `stockMax` (Soll-/Mindestbestand) - inventory-management ambitions
the one-person tire shop never used, and every public/shop query had to
filter on them.

## Decision

Remove all three columns from both tables and every dependent filter.
Public/shop visibility of tires is governed by **`onlineSellable`
alone**; retired tires are deleted from the catalog. `stockOnHand`
stays (needed for the future eBay sync and local overview). Public
services are `kind='service'` rows only.

## Consequences

- Simpler forms, queries, and public projections; the moot
  discontinued-exclusion tests were removed.
- No low-stock warnings - out of scope by decision.
- Related: [[items]], [[tires]], [[adr-014-ebay-two-way-sync-deferred]].
