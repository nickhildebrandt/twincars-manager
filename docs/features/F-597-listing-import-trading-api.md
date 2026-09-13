---
id: F-597
title: Listing-Import (Trading API `GetMyeBaySelling`)
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: ['/settings/ebay']
endpoints: ['importEbayListingsRemote', 'importEbayListings']
tables: ['ebay_listings', 'ebay_import_runs', 'ebay_credentials']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-597 — Listing-Import (Trading API `GetMyeBaySelling`)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Listing-Import (Trading API `GetMyeBaySelling`)

## Erwartetes Verhalten

ActiveList, 200/Seite, max. 50 Seiten, Site 77, Timeout 30 s; Run-Zeile `running` → `success`/`failed`; Upsert keyed `(environment, ebay_item_id)`; neu → `imported`, vorhanden → `updated` (alle Felder überschrieben, `status='active'`, `lastSeenAt=now`); vorher `active` und nicht gesehen → `status='ended'` (nie gelöscht); wieder auftauchend → `active`; Items ohne `ItemID`/`Title` → `failed`; `totalActive` = `TotalNumberOfEntries` (Fallback Item-Anzahl)

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
| Endpoints | `importEbayListingsRemote`, `importEbayListings` |
| Tabellen | `ebay_listings`, `ebay_import_runs`, `ebay_credentials` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-597 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
