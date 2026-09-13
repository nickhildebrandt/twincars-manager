---
id: F-498
title: Validierung Abwesenheit (Client + Server)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: ['/employees/[id]']
endpoints: ['createAbsenceRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-498 — Validierung Abwesenheit (Client + Server)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Validierung Abwesenheit (Client + Server)

## Erwartetes Verhalten

Bis ≥ Von; Spanne ≤ 366 Tage; Halbtag nur eintägig; Krankheit nicht im Folgejahr (Option ausgeblendet für Zukunftsjahre); Same-Type-Überschneidung → 400 mit Zeitraum; Urlaubsbudget je Kalenderjahr hart (400 "Nur noch N Urlaubstage im Jahr YYYY verfügbar (angefragt: M)."), entfällt bei `vacationDaysPerYear = NULL` oder Status Abgesagt

## Nutzersicht

_Wird mit T-017 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-017 ergänzt._

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
| Endpoints | `createAbsenceRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-498 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
