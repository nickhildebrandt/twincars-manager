---
id: F-089
title: Public-API-Rate-Limit
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-031
permission: offen
routes: ['/api/public/*']
endpoints: ['rateLimitPublicApi']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-089 — Public-API-Rate-Limit

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Public-API-Rate-Limit

## Erwartetes Verhalten

120/min + 60 Burst je Token-Präfix, sonst IP; 429 + Meldung

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
| Endpoints | `rateLimitPublicApi` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-089 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
