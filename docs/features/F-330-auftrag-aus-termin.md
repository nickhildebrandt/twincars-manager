---
id: F-330
title: Auftrag aus Termin
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/calendar/[id]/edit']
endpoints: ['getWorkOrderIdForAppointmentRemote', 'createWorkOrderFromAppointmentRemote']
tables: ['calendar_entries', 'work_orders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-330 — Auftrag aus Termin

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Auftrag aus Termin

## Erwartetes Verhalten

Nur `kind='appointment'`; Button "Auftrag erstellen" bzw. Link "Zum Auftrag"; kopiert Titel/Kunde/Fahrzeug/Mitarbeiter; `scheduledDate/Time` aus `startsAt` (allDay → nur Datum); genau ein Auftrag pro Termin (409); Aktionen versteckt, wenn die Probe fehlschlägt

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
| Routen | `/calendar/[id]/edit` |
| Endpoints | `getWorkOrderIdForAppointmentRemote`, `createWorkOrderFromAppointmentRemote` |
| Tabellen | `calendar_entries`, `work_orders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-330 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
