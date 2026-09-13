---
id: F-523
title: Zwei-Stufen-Berechtigung Stunden
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours*']
endpoints: ['requireAnyPermission('hours','hours:write_own')', 'requirePermission('hours')']
tables: ['role_permissions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-523 — Zwei-Stufen-Berechtigung Stunden

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Zwei-Stufen-Berechtigung Stunden

## Erwartetes Verhalten

`hours` = alles sehen/bearbeiten + Reports; `hours:write_own` = nur eigene Einträge, keine Reports, kein Mitarbeiterfilter; Nav "Stunden" an `hours:write_own` gebunden; Rollen-Seed: Administrator `*`, Werkstattleiter beides, Mitarbeiter nur `write_own`

## Nutzersicht

_Wird mit T-018 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-018 ergänzt._

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
| Routen | `/hours*` |
| Endpoints | `requireAnyPermission('hours','hours:write_own')`, `requirePermission('hours')` |
| Tabellen | `role_permissions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-523 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
