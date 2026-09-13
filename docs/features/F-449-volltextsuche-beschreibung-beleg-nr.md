---
id: F-449
title: Volltextsuche Beschreibung/Beleg-Nr.
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger']
endpoints: ['listLedgerEntriesRemote(q)']
tables: ['ledger_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-449 — Volltextsuche Beschreibung/Beleg-Nr.

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Volltextsuche Beschreibung/Beleg-Nr.

## Erwartetes Verhalten

ILIKE `%q%` auf `description` OR `entry_number`, case-insensitiv, 250 ms Debounce, Seite → 1, max 200 Zeichen; nur-set-key im `queryArgs` (`...(q ? { q } : {})`)

## Nutzersicht

_Wird mit T-028 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-028 ergänzt._

## Zustände

| Zustand | Verhalten |
| --- | --- |
| Leer | _offen_ |
| Laden | _offen_ |
| Fehler | _offen_ |
| Keine Berechtigung | _offen_ |

## Technischer Bezug

| | |
| --- | --- |
| Routen | `/ledger` |
| Endpoints | `listLedgerEntriesRemote(q)` |
| Tabellen | `ledger_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-449 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
