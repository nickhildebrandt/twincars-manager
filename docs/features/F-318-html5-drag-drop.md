---
id: F-318
title: HTML5 Drag & Drop
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders']
endpoints: ['moveWorkOrderStatusRemote']
tables: ['work_orders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-318 — HTML5 Drag & Drop

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

HTML5 Drag & Drop

## Erwartetes Verhalten

Karten mit `status !== 'done'` draggable; Zielspalte färbt sich `bg-base-200`; Drop auf "Abgeschlossen" → `toast.info(...)`, keine Änderung; Drop in gleiche Spalte No-op

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
| Routen | `/orders` |
| Endpoints | `moveWorkOrderStatusRemote` |
| Tabellen | `work_orders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-318 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
