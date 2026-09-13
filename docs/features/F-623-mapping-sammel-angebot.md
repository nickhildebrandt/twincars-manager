---
id: F-623
title: Mapping `Angebote`/`AngebotDetails` → `documents` + `document_items` + Sammel-Angebot
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['documents', 'document_items']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-623 — Mapping `Angebote`/`AngebotDetails` → `documents` + `document_items` + Sammel-Angebot

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `Angebote`/`AngebotDetails` → `documents` + `document_items` + Sammel-Angebot

## Erwartetes Verhalten

`Angebotsnummer` Pflicht → `documentNumber='AN-<nr>'`; `Formulartyp`→`type` (`offer`/`cost_estimate`/`order_confirmation`); `Status`→`sent`/`cancelled`; `Angebotsdatum ?? '1900-01-01'` (+Note); Summen wie Rechnung (`AgGesamtbetrag`, `Inkl`, Backfill); Positionen: ohne `Angebotsnummer` → lazy `AN-IMPORT-SAMMEL-<Jahr>` (`type=offer`, `status=sent`, `customerId=null`, `issueDate=1900-01-01`, `taxRate=19`, Summen aus Positionen); nicht auflösbare Nummer → Skip `skipped.offerItems`; Sammel-Angebot zählt in `summary.offers`, wird nicht vorab als PDF gerendert

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
| Tabellen | `documents`, `document_items` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-623 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
