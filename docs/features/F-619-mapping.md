---
id: F-619
title: Mapping `Artikel` → `items` + `item_price_versions`
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['items', 'item_price_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-619 — Mapping `Artikel` → `items` + `item_price_versions`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `Artikel` → `items` + `item_price_versions`

## Erwartetes Verhalten

`Artikel-Nr` Pflicht (Skip) → `legacyItemNumber`; `articleNumber = Artikelnummer ?? Artikel-Nr` (unique!); `description = Artikelbeschreibung ?? articleNumber`; `Art`→`kind`; `Me`→`unit`; `Bestand`→`stockOnHand` (≥0, gerundet); `Anmerkung`→`notes`; `Einzelpreis` → Preisversion `validFrom='2000-01-01'`, `unitPriceNet=String(price)`; Reifen landen ebenfalls in `items` (nicht `tires`)

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
| Routen | — |
| Endpoints | — |
| Tabellen | `items`, `item_price_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-619 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
