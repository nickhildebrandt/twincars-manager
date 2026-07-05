---
title: ADR-007 - Price snapshots on documents + versioned master values
tags: [adr, pricing, data-model]
updated: 2026-07-05
---

# ADR-007: Snapshots on documents, versions on master data

**Status**: accepted, enforced (CONTRIBUTING §16, migrations 0008/0009).

## Context

A 2024 invoice must keep showing the 2024 price forever; salaries and
license plates have the same time-validity property. Joining documents
to current catalog prices would rewrite history.

## Decision

Two complementary mechanisms:

1. **Snapshots**: `document_items` carries its own `unit_price_net`,
   `tax_rate`, `discount_percent`, `line_total_*`. `itemId`/`tireId`
   FKs are for navigation only - read paths never join them for
   prices. `updateItem` never cascades into documents.
2. **Versioned master values**: time-dependent values live in per-domain
   `*_versions` tables (NOT a generic value_versions):
   `item_price_versions`, `tire_price_versions`,
   `employee_salary_versions`, `vehicle_license_plate_versions`.
   Convention: `UNIQUE(entity_id, valid_from)`; active version = max
   `valid_from <= asOf`; service helpers `get<X>At`, `list<X>Versions`,
   `upsert<X>Version`, `delete<X>Version`.

There is intentionally NO `item_price_history` audit table - the
document row is the canonical receipt.

## Consequences

- `items`/`employees` lost their price/salary columns (0008); the only
  price read paths are the service helpers.
- A future "re-cost open invoices" feature must be an explicit audited
  operation, never a side effect of catalog edits.
