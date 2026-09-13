---
id: F-325
title: Creation-Flow 'Neu anlegen'
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/customers/new', '/vehicles/new', '/employees/new']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-325 — Creation-Flow "Neu anlegen"

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Creation-Flow "Neu anlegen"

## Erwartetes Verhalten

Header-Button im Picker-Dialog; Draft (alle Felder inkl. `titleTouched`, Assignee-Labels) in `creationFlow` (sessionStorage, 1 h); Rückkehr setzt Ergebnis in das Ursprungsfeld; Fahrzeug-Leaf erhält `leafInitial` mit Kunde; abweichender Halter überschreibt Kunden; Cycle-Guard je Entität

## Nutzersicht

_Wird mit T-020 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-020 ergänzt._

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
| Routen | `/customers/new`, `/vehicles/new`, `/employees/new` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-325 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
