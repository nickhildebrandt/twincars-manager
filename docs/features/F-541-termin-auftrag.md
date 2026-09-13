---
id: F-541
title: Termin → Auftrag
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar/[id]/edit']
endpoints: ['getWorkOrderIdForAppointmentRemote', 'createWorkOrderFromAppointmentRemote', 'orders']
tables: ['work_orders', 'work_order_assignees', 'number_ranges']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-541 — Termin → Auftrag

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Termin → Auftrag

## Erwartetes Verhalten

Nur für Termine und nur mit `orders`-Recht (Probe; Fehler → Aktionen verborgen, `console.info`); „Auftrag erstellen" → Auftrag mit Titel/Kunde/Fahrzeug/Assignee/`scheduledDate`+`scheduledTime` → Toast „Auftrag angelegt." → `/orders/{id}`; ab dann „Zum Auftrag"; ein Auftrag je Termin (409). Termin-Chip wird durch Auftrags-Chip ersetzt.

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
| Routen | `/calendar/[id]/edit` |
| Endpoints | `getWorkOrderIdForAppointmentRemote`, `createWorkOrderFromAppointmentRemote`, `orders` |
| Tabellen | `work_orders`, `work_order_assignees`, `number_ranges` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-541 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
