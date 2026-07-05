---
title: ADR-004 - Import strategy - wipe-first with read-before-wipe (no full transaction)
tags: [adr, import, legacy]
updated: 2026-07-05
---

# ADR-004: Wipe-first import, staged-with-report safety

**Status**: accepted (production-plan P1.5, step 3), shipped.

## Context

The Kfz-Kaufmann import replaces ALL business data. Full
single-transaction atomicity would require threading a tx handle through
~16 write sites and moving the heavy PDF phase (~10.5k renders) out - a
large, risky restructure of a just-validated pipeline. Originally the
wipe ran BEFORE the first `mdb-export`, so a corrupt file left an empty
database.

## Decision

Keep wipe-first, but harden it as "staged with report":

1. **Read before wipe** - all 13 MDB tables are parsed first; a bad
   file fails before anything is deleted.
2. **Dry-run mode** - full parse/map/validate + skip report with zero
   writes.
3. **Structured skip report** - every dropped row is logged with table,
   legacy key and a German reason; no silent drops.
4. **Audit row always** - `access_import_jobs` records
   running → completed/failed with counts, even on mid-run throw.

Full atomicity is deferred: since the wipe runs first, a failed run
self-heals on re-run (the next import wipes partial state).

## Consequences

- Re-run is the recovery strategy; partial imports are never patched.
- Settings/templates/number ranges/ledger categories survive the wipe.
- Details and mapping: [[kfz-kaufmann-import]].
