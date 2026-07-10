---
title: ADR-014 - eBay integration phased; two-way sync required
tags: [adr, ebay, integration]
updated: 2026-07-10
---

# ADR-014: eBay phased in, sync must be bidirectional

**Status**: Phases 0-2 shipped (0-1 live; 2 built 2026-07-10, operator
consent pending); Phase 3 (bidirectional sync) pending.

## Context

2026-06-22 direction decision deferred eBay behind go-live priorities.
The original spec simplified to "local DB is leading after import"; on
2026-06-23 the user explicitly required **two-way** sync (eBay-side
sales/edits/ended listings must flow back).

## Decision

Phase order: (0) marketplace account-deletion compliance endpoint (the
production-keyset activation gate) → (1) OAuth connect with encrypted
token store → (2) initial listing import via the Trading API (Inventory
API cannot see web-UI-created listings; shipped 2026-07-10 as
`ebay-listing-service.ts` with an injectable transport, idempotent
ended/revive sync and the `ebay_listings` / `ebay_import_runs` tables,
migration 0036) → (3) bidirectional tire sync (Platform Notifications
where available + periodic reconciliation polling,
operator-triggered/cron per [[adr-009-no-in-process-scheduler]]) plus
listing-tire matching. Conflict rules to be decided in the Phase-3
design. eBay calls stay behind a narrow `ebay-*-service.ts` interface,
mock-testable without live credentials.

## Consequences

- `tires.stockOnHand` was kept during shop-refocus specifically for the
  future sync ([[adr-016-shop-refocus]]).
- The spec's planned tables `ebay_listing_links` / `ebay_sync_log`
  materialized as `ebay_listings` (with a prepared-but-unused `tire_id`
  FK as the Phase-3 sync anchor) and `ebay_import_runs`.
- Current state + env/portal specifics: [[ebay]]; original spec:
  `archive/ebay-integration-spec.md`.
