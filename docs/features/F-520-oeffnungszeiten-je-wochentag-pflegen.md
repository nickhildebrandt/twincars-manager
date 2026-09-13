---
id: F-520
title: Öffnungszeiten je Wochentag pflegen
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/settings/workshop-hours']
endpoints: ['listWorkshopHoursRemote', 'updateWorkshopHoursRemote']
tables: ['workshop_hours']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-520 — Öffnungszeiten je Wochentag pflegen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Öffnungszeiten je Wochentag pflegen

## Erwartetes Verhalten

7 Zeilen So–Sa; Öffnet/Schließt `HH:MM`, Toggle Geschlossen deaktiviert Zeitfelder; Speichern = 7 sequentielle Commands; Regel offen → `opensAt < closesAt`; Toast "Öffnungszeiten gespeichert."

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
| Routen | `/settings/workshop-hours` |
| Endpoints | `listWorkshopHoursRemote`, `updateWorkshopHoursRemote` |
| Tabellen | `workshop_hours` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-520 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
