---
id: F-356
title: Zeiterfassungsmodul-Kopplung
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/hours', '/hours/[id]', '/hours/[id]/edit']
endpoints: ['listTimeEntriesRemote({workOrderId})']
tables: ['time_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-356 — Zeiterfassungsmodul-Kopplung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Zeiterfassungsmodul-Kopplung

## Erwartetes Verhalten

Deep-Link-Filter "Gefiltert nach Auftrag" (Chip mit X), Spalte "Auftrag" mit Link, Badge "Auftrag" statt Aktionen, Hinweis "Dieser Eintrag stammt aus einem Auftrag und wird dort gepflegt.", 409 bei Mutation

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
| Routen | `/hours`, `/hours/[id]`, `/hours/[id]/edit` |
| Endpoints | `listTimeEntriesRemote({workOrderId})` |
| Tabellen | `time_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-356 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
