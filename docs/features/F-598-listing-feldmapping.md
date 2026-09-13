---
id: F-598
title: Listing-Feldmapping
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: []
endpoints: ['parseItem']
tables: ['ebay_listings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-598 — Listing-Feldmapping

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Listing-Feldmapping

## Erwartetes Verhalten

`ItemID`→`ebayItemId`; `SKU`; `Title` (≤255); `CurrentPrice`→`priceValue` (2 Nachkommastellen) + `currencyID`→`priceCurrency`; `QuantityAvailable ?? Quantity`; `QuantitySold`; `ListingType`; `ViewItemURL`; `GalleryURL`; alle `PictureURL` → `pictureUrls` (nur URLs, keine Bytes); `StartTime`/`EndTime` → Date; Entities einmal dekodiert. **Kein** Mapping auf `tires`/`items`/Fahrzeuge (`tire_id` bleibt null)

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
| Routen | — |
| Endpoints | `parseItem` |
| Tabellen | `ebay_listings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-598 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
