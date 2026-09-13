---
id: F-526
title: Deutsche Fehlerübersetzung der Feldnamen
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-004
permission: offen
routes: []
endpoints: ['handleValidationError', 'src/hooks.server.ts']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-526 — Deutsche Fehlerübersetzung der Feldnamen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-004** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Deutsche Fehlerübersetzung der Feldnamen

## Erwartetes Verhalten

Labels u. a. `personnelNumber` "Personalnummer", `hireDate` "Eintrittsdatum", `weeklyHours` "Wochenstunden", `vacationDaysPerYear` "Urlaubstage pro Jahr", `halfDay` "Halber Tag", `dateFrom/To` "Datum von/bis", `bankIban` "IBAN", `employeeId` "Mitarbeiter"

## Nutzersicht

_Wird mit T-004 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-004 ergänzt._

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
| Routen | — |
| Endpoints | `handleValidationError`, `src/hooks.server.ts` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-004 ergänzt._

## Quellen

- Inventar: [F-526 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-004 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
