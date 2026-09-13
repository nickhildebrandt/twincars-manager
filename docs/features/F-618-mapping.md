---
id: F-618
title: Mapping `Lieferanten` → `suppliers`
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['suppliers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-618 — Mapping `Lieferanten` → `suppliers`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `Lieferanten` → `suppliers`

## Erwartetes Verhalten

`Lieferantennummer` Pflicht (Skip) → `legacySupplierNumber`; `Firma`→`name` (Fallback `-`); `Kontaktperson`, `Strasse`, `PLZ`, `Ort`, `Land`, `Telefon`, `Fax`, `Email`, `Website`, `Kundennummer`→`customerNumberAtSupplier`, `IBAN`, `BIC`, `BANK`; kein eigener Nummernkreis-Update

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
| Tabellen | `suppliers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-618 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
