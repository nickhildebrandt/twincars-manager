---
id: F-328
title: Auftrag bearbeiten
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/[id]/edit']
endpoints: ['getWorkOrderRemote', 'updateWorkOrderRemote']
tables: ['work_orders', 'work_order_assignees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-328 — Auftrag bearbeiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Auftrag bearbeiten

## Erwartetes Verhalten

Header "Auftrag bearbeiten" mit Subtitle Nummer, Back → Detail; alle Felder werden gesendet (leer = `null`), Assignee-Set ersetzt; Toast "Auftrag gespeichert."; Bearbeiten-Button auf dem Detail fehlt bei `done` — Route/Remote aber nicht gesperrt

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
| Routen | `/orders/[id]/edit` |
| Endpoints | `getWorkOrderRemote`, `updateWorkOrderRemote` |
| Tabellen | `work_orders`, `work_order_assignees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-328 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
