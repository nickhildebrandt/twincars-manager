---
title: ADR-002 - Per-module permissions (no read/write/delete split)
tags: [adr, auth, rbac]
updated: 2026-07-05
---

# ADR-002: One permission key per module

**Status**: accepted 2026-06-22 (binding direction decision), shipped as
production-plan P1.2.

## Context

The original model had `<module>:read|write|delete` keys - ~3x the
grants, a noisy role matrix, and 127 per-action key occurrences across
tests, for a workshop with a handful of trusted users.

## Decision

Collapse to a single key per module: holding `customers` means full
access to the customers module. Wildcard `*` = everything.
`import:run` became `import`. The ONE exception kept:
`hours:write_own` - employees logging only their own time is a real
business boundary, so `hours` has exactly two levels. Do not add further
sub-keys without equivalent justification.

## Consequences

- Role matrix UI is one checkbox per module (hours: "Alle Stunden" /
  "Nur eigene Stunden").
- The seeded Mitarbeiter role became full-access on its operational
  modules (previously read-only) - intended simplification.
- Werkstattleiter is built by flatMap over `MODULE_PERMISSIONS`, so new
  modules are auto-granted to it; Mitarbeiter's list is curated.
- Details: [[auth-and-permissions]]; keys in `src/lib/permissions.ts`.
