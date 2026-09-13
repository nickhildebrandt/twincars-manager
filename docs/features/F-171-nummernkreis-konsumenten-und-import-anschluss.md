---
id: F-171
title: Nummernkreis-Konsumenten und Import-Anschluss
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-006
permission: offen
routes: []
endpoints: ['nextDocumentNumber']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-171 — Nummernkreis-Konsumenten und Import-Anschluss

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-006** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Nummernkreis-Konsumenten und Import-Anschluss

## Erwartetes Verhalten

Belege/Storno/Kunden/Reifen/Einlagerung/Aufträge/Erinnerungen ziehen aus je eigenem kind; MDB-Import setzt customer/invoice/offer/cost_estimate/order_confirmation auf Legacy-Max+1 mit `{N}`.

## Nutzersicht

_Wird mit T-006 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-006 ergänzt._

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
| Endpoints | `nextDocumentNumber` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-006 ergänzt._

## Quellen

- Inventar: [F-171 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-006 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
