---
title: ADR-003 - Pagination fixed at 25, server-side
tags: [adr, ux, pagination]
updated: 2026-07-05
---

# ADR-003: Pagination fixed at 25

**Status**: accepted, enforced (CONTRIBUTING §10).

## Context

Non-technical users; lists of thousands of rows; a page-size selector is
UI noise and makes tests/layout non-deterministic.

## Decision

Every list is server-side paginated (`LIMIT`/`OFFSET`) at exactly 25
rows. No size selector anywhere. Shared `Pagination` component
(count caption + sliding 5-button window). List remotes return
`{ items, total, page, size, pageCount }`. Filter/search changes MUST
reset `pageNum = 1`. No infinite scroll (explicit pages + totals are
part of the audit trail). Pickers use the same component and size.

## Consequences

- Predictable 1080p/A4 layout, bounded responses, simple deterministic
  tests.
- Stale-while-revalidate keeps the previous page visible during loads
  ([[loading-and-busy]]).
- Client-side slicing is forbidden; every list needs a proper remote.
