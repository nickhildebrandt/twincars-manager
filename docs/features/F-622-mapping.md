---
id: F-622
title: Mapping `Teilzahlungen` → `document_payments`
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['document_payments']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-622 — Mapping `Teilzahlungen` → `document_payments`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `Teilzahlungen` → `document_payments`

## Erwartetes Verhalten

Spalten `RGNR`, `Betrag`, `Bezahldatum`, `BezahlArt` (Großschreibung!); `RGNR` Pflicht und auflösbar; Datum + Betrag Pflicht (sonst Skip „Zahlung ohne gültiges Datum oder Betrag."); `method = BezahlArt`

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
| Tabellen | `document_payments` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-622 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
