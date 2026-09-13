---
id: F-009
title: Client-Fehler-Funnel (Toast)
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-008
permission: offen
routes: []
endpoints: ['handleClientError']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-009 — Client-Fehler-Funnel (Toast)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-008** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Client-Fehler-Funnel (Toast)

## Erwartetes Verhalten

Nur kuratierte `HttpError.body.message`, sonst „Es ist leider ein Fehler aufgetreten.“; optionaler Präfix `<base>: `; `console.error`

## Nutzersicht

_Wird mit T-008 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-008 ergänzt._

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
| Endpoints | `handleClientError` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-008 ergänzt._

## Quellen

- Inventar: [F-009 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-008 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
