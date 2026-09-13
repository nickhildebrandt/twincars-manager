---
id: F-453
title: Leerzustand der Liste
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-453 — Leerzustand der Liste

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Leerzustand der Liste

## Erwartetes Verhalten

`EmptyState` "Noch keine Buchungen" / "Für den ausgewählten Monat liegen keine Ein- oder Ausgaben vor.", kein Button; Pagination wird nicht gerendert (`{#if items.length === 0}`)

## Nutzersicht

_Wird mit T-028 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-028 ergänzt._

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
| Routen | `/ledger` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-453 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
