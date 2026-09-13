---
id: F-620
title: Mapping `Rechnungen` → `documents(type='invoice')`
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-620 — Mapping `Rechnungen` → `documents(type='invoice')`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `Rechnungen` → `documents(type='invoice')`

## Erwartetes Verhalten

`Rechnungsnummer` Pflicht (Skip) → `documentNumber` = `legacyDocumentNumber`; `customerId` über `Kunden-Nr` (fehlend → null, kein Skip); `status`: `storniert`→`cancelled`, sonst `paid`; `taxRate = MWSteuer ?? 19`; `issueDate = Rechnungsdatum ?? Bezahldatum ?? '1900-01-01'` (+ Note „[Importiert ohne Datum]"); `dueDate = Bezahldatum`; Summen: `Inkl=true` → brutto gegeben, netto rückgerechnet; sonst `RgGesamtbetrag` = netto; `grossTotal==0` → Backfill aus Positionssummen (Header gewinnt, wenn ≠ 0); `footer = Endtext ?? Werbetext`; `notes` = „[Bestandskorrektur]" / „[Importiert ohne Datum]" / „Sachbearbeiter: …"; `vehicleId=null`; `Bestandskorrektur=true` → Nummer in `inventoryAdjustmentInvoiceNumbers`

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
| Tabellen | `documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-620 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
