---
id: F-349
title: Auftrag löschen mit GoBD-Guard
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/[id]']
endpoints: ['deleteWorkOrderRemote']
tables: ['work_orders', 'time_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-349 — Auftrag löschen mit GoBD-Guard

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Auftrag löschen mit GoBD-Guard

## Erwartetes Verhalten

Button nur ohne `invoiceId`; ConfirmDialog; 409 sobald irgendeine Rechnung (aktiv, storniert, Storno) mit `work_order_id` existiert; entfernt Zeitbuchungen; Toast "Auftrag gelöscht."

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
| Endpoints | `deleteWorkOrderRemote` |
| Tabellen | `work_orders`, `time_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-349 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
