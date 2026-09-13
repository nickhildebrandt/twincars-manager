---
id: F-056
title: Deutsche Login-Fehlermeldungen
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-007
permission: offen
routes: ['/login']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-056 — Deutsche Login-Fehlermeldungen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-007** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Deutsche Login-Fehlermeldungen

## Erwartetes Verhalten

401/403 → „Benutzername oder Passwort ist falsch." (kein Unterschied unbekannt/falsch), 403 mit „deaktiviert" → Server-Text, 429 → Server-Text/Default, sonst generisch

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
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-007 ergänzt._

## Quellen

- Inventar: [F-056 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-007 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
