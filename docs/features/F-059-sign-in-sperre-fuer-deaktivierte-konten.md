---
id: F-059
title: Sign-in-Sperre für deaktivierte Konten
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-007
permission: offen
routes: ['/api/auth/sign-in/*']
endpoints: ['blockDeactivatedSignIn']
tables: ['users.active']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-059 — Sign-in-Sperre für deaktivierte Konten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-007** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Sign-in-Sperre für deaktivierte Konten

## Erwartetes Verhalten

403 mit kuratierter Meldung vor Credential-Prüfung; unbekannte Namen fallen durch

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
| Routen | `/api/auth/sign-in/*` |
| Endpoints | `blockDeactivatedSignIn` |
| Tabellen | `users.active` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-007 ergänzt._

## Quellen

- Inventar: [F-059 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-007 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
