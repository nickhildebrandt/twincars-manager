---
id: F-546
title: Abwesenheiten im Kalender
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar']
endpoints: ['listCalendarEventsRemote']
tables: ['employee_absences']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-546 — Abwesenheiten im Kalender

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Abwesenheiten im Kalender

## Erwartetes Verhalten

Direkt-Read; `planned` und `approved` gleich dargestellt, `cancelled` ausgeblendet; ein Chip je Tag; Halbtag nicht kenntlich; Klick → `/employees/{employeeId}` (Bearbeitung nur dort).

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
| Tabellen | `employee_absences` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-546 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
