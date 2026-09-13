---
id: F-548
title: Aufträge im Kalender
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar']
endpoints: ['listCalendarEventsRemote']
tables: ['work_orders', 'work_order_assignees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-548 — Aufträge im Kalender

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Aufträge im Kalender

## Erwartetes Verhalten

Alle Aufträge mit `scheduled_date` im Monat, unabhängig vom Status; `done` gedimmt/durchgestrichen; `scheduled_time` nur als `startsAt` im Payload (nicht angezeigt); Termin-geborene Aufträge ersetzen den Termin-Chip; Mitarbeiterfilter über Assignees; Klick → `/orders/{id}`.

## Nutzersicht

_Wird mit T-019 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-019 ergänzt._

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
| Endpoints | `listCalendarEventsRemote` |
| Tabellen | `work_orders`, `work_order_assignees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-548 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
