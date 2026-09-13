---
id: F-017
title: Setup-Gate
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-010
permission: offen
routes: []
endpoints: ['getLayoutContext']
tables: ['company_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-017 — Setup-Gate

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Setup-Gate

## Erwartetes Verhalten

`setupCompleted=false` → Shell-los rendern + clientseitig `goto('/setup')`

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
| Routen | — |
| Endpoints | `getLayoutContext` |
| Tabellen | `company_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-017 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
