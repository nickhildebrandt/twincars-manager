---
id: F-524
title: Berechtigung Mitarbeiter/Abwesenheiten
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: ['/employees*']
endpoints: ['requirePermission('employees')']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-524 — Berechtigung Mitarbeiter/Abwesenheiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Berechtigung Mitarbeiter/Abwesenheiten

## Erwartetes Verhalten

Ein Schlüssel für Stammdaten inkl. Gehalt/Steuer/Bank und Abwesenheiten; `hours`-Rechte öffnen keine Absence-Remotes; Rolle "Mitarbeiter" hat kein `employees` → kein Self-Service-Blick auf eigene Abwesenheiten/Resturlaub

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
| Routen | `/employees*` |
| Endpoints | `requirePermission('employees')` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-524 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
