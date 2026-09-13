---
id: F-478
title: Rechnungsausgangsbuch (Abgrenzung)
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-029
permission: offen
routes: ['/sales-ledger']
endpoints: ['getSalesLedgerRemote']
tables: ['documents', 'customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-478 — Rechnungsausgangsbuch (Abgrenzung)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-029** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rechnungsausgangsbuch (Abgrenzung)

## Erwartetes Verhalten

Perioden-Presets, alle Rechnungsstatus inkl. Entwürfe/Storno/storniert, Summen Netto/MwSt/Brutto in JS, `<tfoot>`-Summe, Mobile-Liste, Zeilenklick → Rechnung; ohne Pagination/Suche/Export

## Nutzersicht

_Wird mit T-029 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-029 ergänzt._

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
| Routen | `/sales-ledger` |
| Endpoints | `getSalesLedgerRemote` |
| Tabellen | `documents`, `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-029 ergänzt._

## Quellen

- Inventar: [F-478 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-029 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
