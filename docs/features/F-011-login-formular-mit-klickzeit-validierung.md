---
id: F-011
title: Login-Formular mit Klickzeit-Validierung
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-007
permission: offen
routes: ['/login']
endpoints: ['authClient.signIn.username']
tables: ['users', 'accounts', 'sessions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-011 — Login-Formular mit Klickzeit-Validierung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-007** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Login-Formular mit Klickzeit-Validierung

## Erwartetes Verhalten

Benutzername 3–64 (trim), Passwort 8–128; Button nur bei `busy.active` disabled; deutsche Fehlermeldungen; `novalidate`

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
| Endpoints | `authClient.signIn.username` |
| Tabellen | `users`, `accounts`, `sessions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-007 ergänzt._

## Quellen

- Inventar: [F-011 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-007 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
