---
id: F-350
title: Statusmaschine
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: []
endpoints: ['moveWorkOrderStatusRemote', 'completeWorkOrderRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-350 — Statusmaschine

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Statusmaschine

## Erwartetes Verhalten

`open ⇄ in_progress`; `→ done` ausschließlich über Abschluss (Schema des Move-Commands kennt `done` nicht; Service 409 als Backstop); `done → in_progress` nur ohne aktive Rechnung (automatisch durch Storno); alle Übergänge nur mit Permission `orders` (keine Rollen-Differenzierung)

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
| Routen | — |
| Endpoints | `moveWorkOrderStatusRemote`, `completeWorkOrderRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-350 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
