---
id: F-483
title: Mitarbeiter anlegen (Stammdaten)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: ['/employees/new']
endpoints: ['createEmployeeRemote']
tables: ['employees', 'employee_salary_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-483 — Mitarbeiter anlegen (Stammdaten)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mitarbeiter anlegen (Stammdaten)

## Erwartetes Verhalten

Pflicht: Vorname, Nachname (client); Personalnr. optional, sonst `MA-NNNN` aus Zeilenzahl; Felder s. §4; Erfolg → Detail (replaceState) + Toast "Mitarbeiter angelegt."

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
| Routen | `/employees/new` |
| Endpoints | `createEmployeeRemote` |
| Tabellen | `employees`, `employee_salary_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-483 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
