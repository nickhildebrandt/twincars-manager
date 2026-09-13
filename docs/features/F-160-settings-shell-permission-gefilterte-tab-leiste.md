---
id: F-160
title: Settings-Shell: permission-gefilterte Tab-Leiste
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/settings/*']
endpoints: ['getCurrentUserRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-160 — Settings-Shell: permission-gefilterte Tab-Leiste

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Settings-Shell: permission-gefilterte Tab-Leiste

## Erwartetes Verhalten

11 Tabs (§1); `*` oder Modul-Key sichtbar, Konto immer; Nav-Modus (Radio → goto), Allgemein exakt, andere Prefix; Leiste nur bei >1 Tab und passender Route, sonst Inhalt bare.

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
| Routen | `/settings/*` |
| Endpoints | `getCurrentUserRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-160 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
