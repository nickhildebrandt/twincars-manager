---
id: F-488
title: Gehaltshistorie (read-only)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: ['/employees/[id]']
endpoints: ['listEmployeeSalaryVersionsRemote']
tables: ['employee_salary_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-488 — Gehaltshistorie (read-only)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Gehaltshistorie (read-only)

## Erwartetes Verhalten

Tabelle Gültig ab (dd.mm.yyyy), Monatslohn, Stundenlohn (€), Erfasst; Kopfzeile "Aktuell: X € / Monat" bzw. "/ Std." bzw. "kein Gehalt hinterlegt"; Leerzustand "Noch keine Gehaltsversionen erfasst." Keine Anlage/Löschung über UI

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
| Endpoints | `listEmployeeSalaryVersionsRemote` |
| Tabellen | `employee_salary_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-488 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
