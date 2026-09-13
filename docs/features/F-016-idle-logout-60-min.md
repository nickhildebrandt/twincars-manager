---
id: F-016
title: Idle-Logout 60 min
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-007
permission: offen
routes: []
endpoints: ['authClient.signOut']
tables: ['sessions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-016 — Idle-Logout 60 min

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-007** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Idle-Logout 60 min

## Erwartetes Verhalten

Events mousemove/keydown/click/scroll/touchstart; nach 60 min Inaktivität Logout + `/login?reason=idle`; pro Tab; keine Vorwarnung

## Nutzersicht

_Wird mit T-007 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-007 ergänzt._

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
| Endpoints | `authClient.signOut` |
| Tabellen | `sessions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-007 ergänzt._

## Quellen

- Inventar: [F-016 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-007 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
