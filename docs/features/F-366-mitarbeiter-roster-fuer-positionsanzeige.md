---
id: F-366
title: Mitarbeiter-Roster für Positionsanzeige
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/[id]']
endpoints: ['pickEmployeesRemote({page:1,size:100})']
tables: ['employees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-366 — Mitarbeiter-Roster für Positionsanzeige

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mitarbeiter-Roster für Positionsanzeige

## Erwartetes Verhalten

Beim Laden einmalig 100 nicht archivierte Mitarbeiter geholt; Map `employeeLabelById` löst Namen der Positions-Mitarbeiter auf; Fallback "-"

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
| Routen | `/orders/[id]` |
| Endpoints | `pickEmployeesRemote({page:1,size:100})` |
| Tabellen | `employees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-366 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
