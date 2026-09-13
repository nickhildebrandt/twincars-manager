---
id: F-168
title: Unsaved-Changes-Guard auf Allgemein
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/settings']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-168 — Unsaved-Changes-Guard auf Allgemein

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Unsaved-Changes-Guard auf Allgemein

## Erwartetes Verhalten

`oninput/onchange` → `formDirty.set(true)`; Sidebar-/Tab-Navigation öffnet ConfirmDialog (AppShell), Reload Browser-Warnung; beim Verlassen `formDirty.clear()` im Effect-Cleanup.

## Nutzersicht

_Wird mit T-010 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-010 ergänzt._

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
| Routen | `/settings` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-168 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
