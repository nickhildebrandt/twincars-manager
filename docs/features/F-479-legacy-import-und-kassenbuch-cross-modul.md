---
id: F-479
title: Legacy-Import und Kassenbuch (Cross-Modul)
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-033
permission: offen
routes: ['/settings/import']
endpoints: ['import-service']
tables: ['ledger_entries', 'recurring_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-479 — Legacy-Import und Kassenbuch (Cross-Modul)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Legacy-Import und Kassenbuch (Cross-Modul)

## Erwartetes Verhalten

Import löscht alle Buchungen und wiederkehrenden Vorlagen, behält Kategorien; importiert keine Buchungen

## Nutzersicht

_Wird mit T-033 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-033 ergänzt._

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
| Routen | `/settings/import` |
| Endpoints | `import-service` |
| Tabellen | `ledger_entries`, `recurring_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-479 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
