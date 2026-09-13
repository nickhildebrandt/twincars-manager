---
id: F-002
title: Session-Populierung + sofortige Deaktivierungs-Sperre
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-007
permission: offen
routes: []
endpoints: ['populateAuthLocals']
tables: ['sessions', 'users.active', 'user_roles', 'role_permissions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-002 — Session-Populierung + sofortige Deaktivierungs-Sperre

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-007** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Session-Populierung + sofortige Deaktivierungs-Sperre

## Erwartetes Verhalten

`locals.user/permissions` pro Request; `active=false` → wie anonym (Cookie-Cache 5 min wird umgangen)

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
| Endpoints | `populateAuthLocals` |
| Tabellen | `sessions`, `users.active`, `user_roles`, `role_permissions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-007 ergänzt._

## Quellen

- Inventar: [F-002 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-007 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
