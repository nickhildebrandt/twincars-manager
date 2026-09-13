---
id: F-530
title: Mitarbeiterfilter
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar']
endpoints: ['pickEmployeesRemote', 'employees', 'orders', 'listCalendarEventsRemote']
tables: ['employees', 'work_order_assignees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-530 — Mitarbeiterfilter

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mitarbeiterfilter

## Erwartetes Verhalten

`SearchablePicker` (Placeholder „Alle Mitarbeiter", Dialog „Mitarbeiter filtern", `triggerSize sm`); Filter reduziert Termine (`employee_id`), Abwesenheiten, Aufträge (Assignee); Feiertage/HU bleiben; Schließungen fallen weg (Ist-Verhalten, B-456). Suche über Vor-/Nachname, Personalnummer, Position, private E-Mail/Telefon, Mobil; nur `archived=false`; 25/Seite.

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
| Endpoints | `pickEmployeesRemote`, `employees`, `orders`, `listCalendarEventsRemote` |
| Tabellen | `employees`, `work_order_assignees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-530 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
