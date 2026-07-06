---
title: TwinCarsManager Knowledge Base (MOC)
tags: [moc, index]
updated: 2026-07-06
---

# TwinCarsManager - Map of Content

This folder is the project's "AI brain": a dense, interlinked, factual
knowledge base mined from the actual code. Every note covers one topic,
carries YAML frontmatter and links to its neighbours with `[[wikilinks]]`.
`CLAUDE.md` and `CONTRIBUTING.md` at the repo root remain the binding
rulebooks; these notes explain, connect and locate - they do not override.

## Domain (what the business is)

- [[business-overview]] - TwinCast: Kfz-Werkstatt, Reifenhandel, Gebrauchtwagen
- [[entities]] - the entity map (Kunde, Fahrzeug, Beleg, Reifen, ...)
- [[document-types]] - Beleg types: Rechnung, Angebot, KV, AB, Storno, Zahlungserinnerung
- [[glossary]] - German domain terms used in UI and data

## Architecture

- [[remote-functions]] - the only server transport + the 4 documented `+server.ts` exceptions
- [[auth-and-permissions]] - better-auth, sessions, per-module RBAC, deactivation
- [[database-schema]] - all tables by group, versioned values, snapshots
- [[validation-and-errors]] - Valibot with German messages, error funnels
- [[loading-and-busy]] - the single `busy` store and the three loading tiers
- [[styling]] - DaisyUI v5 + Tailwind v4 rules, card baseline, forbidden patterns
- [[pdf-pipeline]] - pdf-lib rendering, bytea cache, `pdfs.remote.ts`, labels/signs
- [[pwa-service-worker]] - installable PWA, precache strategy, dev unregistration
- [[known-constraints]] - pinned versions and why, dev-only hydration issue, otel shim

## Modules (one note per route module)

Customers & vehicles: [[customers]] · [[vehicles]] · [[inventory]] · [[tire-storage]]
Documents & money: [[orders]] · [[offers]] · [[invoices]] · [[reminders]] · [[sales-ledger]] · [[ledger]]
Master data: [[items]] · [[tires]] · [[suppliers]]
People & time: [[employees]] · [[hours]] · [[calendar]]
Communication: [[mailings]] · [[sent]] · [[posts]]
System: [[settings]] · [[import]] · [[setup]] · [[search]] · [[dashboard-and-login]]

## Integrations

- [[ebay]] - compliance endpoint, OAuth connect, encrypted tokens, next phases
- [[public-rest-api]] - Bearer-token REST API for the website (all endpoints)
- [[xrechnung]] - EN 16931 / UBL 2.1 e-invoice XML sidecar
- [[datev]] - DATEV Buchungsstapel CSV export for the Steuerberater
- [[smtp-mail]] - nodemailer pipeline, templates, broadcasts, unsubscribe
- [[kfz-kaufmann-import]] - legacy Access MDB import: tables, rules, quirks

## Operations

- [[deployment]] - Hetzner Podman pod, Quadlet, Caddy, registry, update flow
- [[environment-variables]] - every env var, where it lives, who sets it
- [[backup-and-restore]] - daily + predeploy pg_dump, Storagebox, restore
- [[fresh-db-reset]] - runbook for recreating a database (dev and prod)
- [[dev-environment]] - pnpm, Postgres, mdbtools, mail catcher, headless E2E

## Decisions (ADRs)

- [[adr-001-remote-functions-only]]
- [[adr-002-per-module-permissions]]
- [[adr-003-pagination-fixed-25]]
- [[adr-004-import-wipe-first-read-before-wipe]]
- [[adr-005-encryption-scope]]
- [[adr-006-pdfs-in-postgres]]
- [[adr-007-price-snapshots-and-versions]]
- [[adr-008-single-busy-store]]
- [[adr-009-no-in-process-scheduler]]
- [[adr-010-api-tokens-in-env]]
- [[adr-011-unified-calendar-entries]]
- [[adr-012-pnpm-and-exact-pins]]
- [[adr-013-username-only-auth]]
- [[adr-014-ebay-two-way-sync-deferred]]
- [[adr-015-storno-instead-of-delete]]
- [[adr-016-shop-refocus]]
- [[adr-017-broadcast-unsubscribe-mailto]]
- [[adr-018-otel-noop-shim]]

## Archive

Superseded plan trackers and design specs, moved verbatim (do not update):

- `archive/twincast-production-plan.md` - the 2026-06 production-readiness tracker (P1/P2 all done except eBay phases; rich historical detail on the import hardening)
- `archive/ebay-integration-spec.md` - original eBay spec; current state now lives in [[ebay]]
- `archive/specs/2026-05-02-unified-calendar-entries-design.md` - see [[adr-011-unified-calendar-entries]]
- `archive/specs/2026-05-26-hetzner-podman-deployment-design.md` - see [[deployment]]
- `archive/specs/2026-06-23-employee-absences-vacation-design.md` - approved but NOT yet implemented design (Resturlaub, carryover, workday-service); see [[employees]]
- `archive/plans/2026-05-26-hetzner-podman-deployment.md` - task-level deployment plan

## Conventions for this knowledge base

- Note bodies in English; German UI/domain terms quoted ("Reifeneinlagerung").
- One topic per note, YAML frontmatter with `title` / `tags` / `updated`.
- Claims are verified against code; when documenting new behavior, read the
  source first and update the `updated` field.
- File paths in notes are repo-relative (`src/routes/...`).
