---
id: F-621
title: Mapping `RechnungDetails` → `document_items`
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['document_items']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-621 — Mapping `RechnungDetails` → `document_items`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `RechnungDetails` → `document_items`

## Erwartetes Verhalten

`Rechnungsnummer` Pflicht und auflösbar (Skip mit Grund, zählt in `skipped.invoiceItems`); `positionNumber` 1..n je Beleg (Legacy `pos` global ignoriert); `Artikel-Nr` ≠ `0` → `itemId` über Map (sonst null); `Anzahl ?? 1`; `Einzelpreis ?? 0` als `unitPriceNet` (unabhängig von `Inkl`); `Rabatt ?? 0`; `taxRate` = Header-Satz; `lineTotalNet = round(qty·price·(1−rabatt/100))`, `lineTotalGross = round(net·(1+rate/100))`; `Art`→`kind`; `Artikelnummer ?? Artikel-Nr`; `Artikelbeschreibung ?? '-'`; `Mengeneinheit`→`unit`

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
| Tabellen | `document_items` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-621 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
