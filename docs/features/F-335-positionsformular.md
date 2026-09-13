---
id: F-335
title: Positionsformular
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/[id]']
endpoints: ['addWorkOrderItemRemote']
tables: ['work_order_items', 'time_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-335 — Positionsformular

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Positionsformular

## Erwartetes Verhalten

Join-Radios "Arbeitszeit" (default) / "Material"; Felder s. Flow; Prefill Stundensatz aus `getLaborRateRemote` (nur labor); Materialpreis leer bis Katalogwahl; Einheit nur material (`maxlength=20`); Erledigt am default heute; nach Erfolg Reset (Art bleibt)

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
| Endpoints | `addWorkOrderItemRemote` |
| Tabellen | `work_order_items`, `time_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-335 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
