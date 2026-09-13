---
id: F-358
title: Fahrzeug-Löschguard zählt Aufträge
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/vehicles/[id]']
endpoints: ['deleteVehicle']
tables: ['work_orders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-358 — Fahrzeug-Löschguard zählt Aufträge

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Fahrzeug-Löschguard zählt Aufträge

## Erwartetes Verhalten

"Es sind noch … N Auftrag/Aufträge … verknüpft. Bitte entfernen Sie zuerst die Verknüpfungen oder archivieren Sie das Fahrzeug." (`vehicle-service.ts:341-350`); Kunden-Löschguard zählt **keine** Aufträge (B-281)

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
| Routen | `/vehicles/[id]` |
| Endpoints | `deleteVehicle` |
| Tabellen | `work_orders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-358 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
