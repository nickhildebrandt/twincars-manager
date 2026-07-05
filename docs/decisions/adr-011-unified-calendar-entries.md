---
title: ADR-011 - Unified calendar_entries table
tags: [adr, calendar, data-model]
updated: 2026-07-05
---

# ADR-011: One calendar table, kind-discriminated

**Status**: accepted 2026-05-02, shipped (migration 0005). Full design:
`archive/specs/2026-05-02-unified-calendar-entries-design.md`.

## Context

`appointments` and `business_closures` were separate tables with two
disjoint forms behind tabs; every calendar read UNIONed them. The split
reflected scaffolding history, not a domain difference.

## Decision

Replace both with `calendar_entries` discriminated by `kind`
(`appointment` | `closure`). Kind invariants (closure = forced allDay,
null status/links; appointment = status picklist + optional
customer/vehicle/employee) are enforced in the remote inputSchema, not
the DB. `public_holidays` and `employee_absences` deliberately stay in
their own tables (rule/record-populated - folding them in would create
a junk drawer).

## Consequences

- One form card, one create remote, simpler service.
- The month-grid feed still emits distinct event kinds (appointment,
  business_closure, public_holiday, employee_vacation/sick/other).
- Details: [[calendar]].
