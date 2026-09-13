---
id: F-503
title: Abwesenheit ändern (Datum/Typ/Notiz/Halbtag)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: []
endpoints: ['updateAbsenceRemote']
tables: ['employee_absences']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-503 — Abwesenheit ändern (Datum/Typ/Notiz/Halbtag)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Abwesenheit ändern (Datum/Typ/Notiz/Halbtag)

## Erwartetes Verhalten

Server-Fähigkeit vorhanden inkl. Merge-Prüfungen (Same-Type 400, Kreuz 409 ohne Replace, Budget mit `excludeId`, Cancel überspringt alles); **keine UI**

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
| Routen | — |
| Endpoints | `updateAbsenceRemote` |
| Tabellen | `employee_absences` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-503 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
