---
id: F-363
title: Zuweisungen (Assignees)
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: []
endpoints: ['replaceAssignees']
tables: ['work_order_assignees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-363 — Zuweisungen (Assignees)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Zuweisungen (Assignees)

## Erwartetes Verhalten

Set-Ersetzung (delete + insert), Duplikate entfernt, max. 50; Anzeige "Vorname Nachname" (Detail/Kanban, sortiert Nachname/Vorname) vs. "Vorname Nachname · Personalnummer" (Picker); Mitarbeiterlöschung kaskadiert Zuweisung

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
| Endpoints | `replaceAssignees` |
| Tabellen | `work_order_assignees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-363 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
