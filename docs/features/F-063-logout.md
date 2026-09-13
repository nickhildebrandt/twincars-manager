---
id: F-063
title: Logout
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-007
permission: offen
routes: []
endpoints: ['/api/auth/sign-out']
tables: ['sessions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-063 — Logout

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-007** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Logout

## Erwartetes Verhalten

Session gelöscht, Full-Reload `/login`; Fehler-Toast

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
| Endpoints | `/api/auth/sign-out` |
| Tabellen | `sessions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-007 ergänzt._

## Quellen

- Inventar: [F-063 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-007 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
