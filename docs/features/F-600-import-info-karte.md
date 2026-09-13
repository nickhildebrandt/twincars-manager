---
id: F-600
title: Import-Info-Karte
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: ['/settings/ebay']
endpoints: ['getEbayImportInfoRemote']
tables: ['ebay_import_runs', 'ebay_listings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-600 — Import-Info-Karte

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Import-Info-Karte

## Erwartetes Verhalten

Badge „N aktiv / N gesamt" (nur wenn `listingCount>0`); Text „Noch kein Import durchgeführt." / Erfolgstext / Fehlertext in rot; Button „Angebote importieren" immer klickbar (nur `busy`), Spinner während `busy`; Erfolgs-Toast mit Zählern; Info-Query wird auch bei Fehler refreshed (`finally`)

## Nutzersicht

_Wird mit T-032 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-032 ergänzt._

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
| Routen | `/settings/ebay` |
| Endpoints | `getEbayImportInfoRemote` |
| Tabellen | `ebay_import_runs`, `ebay_listings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-600 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
