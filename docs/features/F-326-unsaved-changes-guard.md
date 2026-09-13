---
id: F-326
title: Unsaved-Changes-Guard
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: []
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-326 — Unsaved-Changes-Guard

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Unsaved-Changes-Guard

## Erwartetes Verhalten

`formDirty.set(true)` bei `oninput/onchange`/Picker-Änderung/Draft-Restore; `clear()` bei Start des Creation-Flows, nach erfolgreichem Save (vor `goto`) und beim Unmount; fehlgeschlagener Save bleibt dirty

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
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-326 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
