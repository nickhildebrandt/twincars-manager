---
id: F-055
title: Login mit Benutzername + Passwort
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-007
permission: offen
routes: ['/login']
endpoints: ['/api/auth/sign-in/username']
tables: ['users', 'accounts', 'sessions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-055 — Login mit Benutzername + Passwort

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-007** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Login mit Benutzername + Passwort

## Erwartetes Verhalten

Client-Validierung bei Klick (3..64 / 8..128), Username getrimmt, serverseitig lowercase-Lookup; Erfolg = Session-Cookie + Full-Reload auf `redirectTo` (nur Pfade mit `/`, nicht `//`) sonst `/`; Button nur bei `busy.active` disabled

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
| Routen | `/login` |
| Endpoints | `/api/auth/sign-in/username` |
| Tabellen | `users`, `accounts`, `sessions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-007 ergänzt._

## Quellen

- Inventar: [F-055 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-007 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
