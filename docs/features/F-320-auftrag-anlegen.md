---
id: F-320
title: Auftrag anlegen
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/new']
endpoints: ['createWorkOrderRemote']
tables: ['work_orders', 'work_order_assignees', 'number_ranges']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-320 — Auftrag anlegen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Auftrag anlegen

## Erwartetes Verhalten

Nummer `AU-{YYYY}-{NNNN}`, `status='open'`; Toast "Auftrag angelegt."; `goto` mit `replaceState`; `formDirty.clear()` vor `goto`

## Nutzersicht

_Wird mit T-020 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-020 ergänzt._

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
| Routen | `/orders/new` |
| Endpoints | `createWorkOrderRemote` |
| Tabellen | `work_orders`, `work_order_assignees`, `number_ranges` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-320 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
