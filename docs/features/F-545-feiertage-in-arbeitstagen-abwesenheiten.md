---
id: F-545
title: Feiertage in Arbeitstagen (Abwesenheiten)
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/employees/[id]']
endpoints: []
tables: ['employee_absences', 'employees.vacationDaysPerYear']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-545 — Feiertage in Arbeitstagen (Abwesenheiten)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Feiertage in Arbeitstagen (Abwesenheiten)

## Erwartetes Verhalten

Arbeitstage = Mo–Fr minus Feiertage des Bundeslandes; Halbtag 0,5; Resturlaub und harte Budget-Sperre nutzen dieselbe Quelle (`absence-service.ts:40-58`, `:327-364`).

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
| Routen | `/employees/[id]` |
| Endpoints | — |
| Tabellen | `employee_absences`, `employees.vacationDaysPerYear` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-545 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
