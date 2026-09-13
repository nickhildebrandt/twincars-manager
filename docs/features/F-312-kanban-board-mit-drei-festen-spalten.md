---
id: F-312
title: Kanban-Board mit drei festen Spalten
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders']
endpoints: ['kanbanBoardRemote']
tables: ['work_orders', 'work_order_assignees', 'customers', 'vehicles', 'vehicle_license_plate_versions', 'documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-312 — Kanban-Board mit drei festen Spalten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kanban-Board mit drei festen Spalten

## Erwartetes Verhalten

Spalten "Offen", "In Bearbeitung", "Abgeschlossen" (Labels aus `workOrderStatusLabel`, `status-labels.ts:150-154`), Zähler-Badge je Spalte, Leerzustand "Keine Aufträge.", Grid 1 Spalte mobil / 3 ab `md`

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
| Routen | `/orders` |
| Endpoints | `kanbanBoardRemote` |
| Tabellen | `work_orders`, `work_order_assignees`, `customers`, `vehicles`, `vehicle_license_plate_versions`, `documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-312 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
