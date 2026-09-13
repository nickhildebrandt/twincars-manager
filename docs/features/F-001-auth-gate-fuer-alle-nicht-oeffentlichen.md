---
id: F-001
title: Auth-Gate für alle nicht-öffentlichen Routen
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-007
permission: offen
routes: []
endpoints: ['requireAuthHandle']
tables: ['sessions', 'users']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-001 — Auth-Gate für alle nicht-öffentlichen Routen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-007** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Auth-Gate für alle nicht-öffentlichen Routen

## Erwartetes Verhalten

Ohne Session 303 auf `/login?redirectTo=<pfad+query>`; öffentlich: `/login`, `/api/auth`, `/api/public`, `/api/ebay/account-deletion`, `/setup`, `/_app`, `/favicon`

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
| Endpoints | `requireAuthHandle` |
| Tabellen | `sessions`, `users` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-007 ergänzt._

## Quellen

- Inventar: [F-001 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-007 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
