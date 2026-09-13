---
id: F-355
title: Kalender-Integration
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/calendar']
endpoints: ['listCalendarEvents']
tables: ['work_orders', 'work_order_assignees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-355 — Kalender-Integration

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kalender-Integration

## Erwartetes Verhalten

Aufträge mit `scheduled_date` als `work_order`-Events (alle Status; done gemutet/durchgestrichen); Uhrzeit optional (all-day-Chip); Mitarbeiterfilter über Assignees; Ursprungs-Termin eines Auftrags wird ausgeblendet

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
| Routen | `/calendar` |
| Endpoints | `listCalendarEvents` |
| Tabellen | `work_orders`, `work_order_assignees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-355 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
