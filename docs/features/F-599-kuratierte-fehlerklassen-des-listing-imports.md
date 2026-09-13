---
id: F-599
title: Kuratierte Fehlerklassen des Listing-Imports
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: ['/settings/ebay']
endpoints: ['importEbayListingsRemote']
tables: ['ebay_import_runs.error']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-599 — Kuratierte Fehlerklassen des Listing-Imports

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kuratierte Fehlerklassen des Listing-Imports

## Erwartetes Verhalten

409 notConnected / 409 tokenExpired (HTTP 401, ErrorCodes 931/932/17470/21916984) / 502 refreshFailed / 502 unreachable / 502 rejected / 502 malformed – nur diese Texte erreichen Client und Run-Log; Rohantworten (≤500 Zeichen) nur `console.error`

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
| Endpoints | `importEbayListingsRemote` |
| Tabellen | `ebay_import_runs.error` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-599 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
