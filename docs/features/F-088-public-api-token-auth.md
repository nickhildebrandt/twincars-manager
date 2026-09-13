---
id: F-088
title: Public-API-Token-Auth
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-031
permission: offen
routes: ['/api/public/*']
endpoints: ['authenticateRequest']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-088 — Public-API-Token-Auth

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Public-API-Token-Auth

## Erwartetes Verhalten

Bearer aus `API_TOKENS`, konstante Zeit, fail-closed, nur 8-Zeichen-Präfix downstream

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
| Endpoints | `authenticateRequest` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-088 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
