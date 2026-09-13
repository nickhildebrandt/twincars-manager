---
id: F-557
title: Bearer-Token-Authentifizierung aus `API_TOKENS`
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/*']
endpoints: ['publicApi', 'authenticateRequest', 'verifyApiToken']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-557 — Bearer-Token-Authentifizierung aus `API_TOKENS`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Bearer-Token-Authentifizierung aus `API_TOKENS`

## Erwartetes Verhalten

Token aus Env (`,`/`;`/Newline getrennt, Einträge < 8 Zeichen ignoriert), Vergleich zeitkonstant, leer/unset = alles 401; `OPTIONS` ohne Auth; nur 8-Zeichen-Präfix nach innen; keine Rotation ohne Neustart, keine Scopes

## Nutzersicht

_Wird mit T-031 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-031 ergänzt._

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
| Routen | `/api/public/*` |
| Endpoints | `publicApi`, `authenticateRequest`, `verifyApiToken` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-557 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
