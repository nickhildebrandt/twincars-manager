---
title: ADR-014 - eBay integration phased; two-way sync required
tags: [adr, ebay, integration]
updated: 2026-07-05
---

# ADR-014: eBay phased in, sync must be bidirectional

**Status**: partially shipped (Phases 0-1 live); sync phases pending.

## Context

2026-06-22 direction decision deferred eBay behind go-live priorities.
The original spec simplified to "local DB is leading after import"; on
2026-06-23 the user explicitly required **two-way** sync (eBay-side
sales/edits/ended listings must flow back).

## Decision

Phase order: (0) marketplace account-deletion compliance endpoint (the
production-keyset activation gate) → (1) OAuth connect with encrypted
token store → (2) initial listing import via the Trading API (Inventory
API cannot see web-UI-created listings) → (3) bidirectional tire sync
(Platform Notifications where available + periodic reconciliation
polling, operator-triggered/cron per
[[adr-009-no-in-process-scheduler]]). Conflict rules to be decided in
the Phase-2/3 design. eBay calls stay behind a narrow
`ebay-*-service.ts` interface, mock-testable without live credentials.

## Consequences

- `tires.stockOnHand` was kept during shop-refocus specifically for the
  future sync ([[adr-016-shop-refocus]]).
- Planned tables `ebay_listing_links` / `ebay_sync_log` are not yet in
  the schema.
- Current state + env/portal specifics: [[ebay]]; original spec:
  `archive/ebay-integration-spec.md`.
