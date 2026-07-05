---
title: ADR-015 - Storno invoices instead of deletion (GoBD)
tags: [adr, invoices, compliance, gobd]
updated: 2026-07-05
---

# ADR-015: Invoices are cancelled by Storno, never deleted

**Status**: accepted (migration 0020), enforced.

## Context

German bookkeeping rules (GoBD, § 14 UStG, §§ 145 ff. AO): an issued
invoice must remain immutable and traceable; corrections happen through
a cancellation invoice that exactly negates the original.

## Decision

Two mutually-exclusive self-referencing columns on `documents`:

- Original invoice: `cancelledByDocumentId` → the Storno row, plus
  `cancelledAt` + `cancellationReason`. Null = still valid.
- Storno invoice: `type='invoice'`, `status='storno'`, negated totals,
  `cancelsDocumentId` → the original, number from the `storno` range
  (`S-{N}`).

The FK constraints are added by raw SQL in the migration (Drizzle
self-FKs are awkward); both directions are indexed for audit lookups.

## Consequences

- `deleteInvoiceRemote` is limited to never-issued cases; the UI path
  for issued invoices is `cancelInvoiceRemote`.
- Storno rows appear in [[sales-ledger]] and [[datev]] with negative
  amounts.
- Details: [[invoices]], [[document-types]].
