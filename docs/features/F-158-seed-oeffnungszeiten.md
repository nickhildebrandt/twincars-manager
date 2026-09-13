---
id: F-158
title: Seed Öffnungszeiten
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-005
permission: offen
routes: []
endpoints: ['seedDefaultWorkshopHours']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-158 — Seed Öffnungszeiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-005** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Seed Öffnungszeiten

## Erwartetes Verhalten

7 Zeilen, Mo–Fr offen 08:00–17:00, Sa/So geschlossen; Operator-Änderungen bleiben.

## Nutzersicht

_Wird mit T-005 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-005 ergänzt._

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
| Endpoints | `seedDefaultWorkshopHours` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-005 ergänzt._

## Quellen

- Inventar: [F-158 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-005 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
