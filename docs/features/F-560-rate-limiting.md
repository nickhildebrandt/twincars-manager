---
id: F-560
title: Rate-Limiting
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/*']
endpoints: ['rateLimitPublicApi', 'publicApi']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-560 — Rate-Limiting

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rate-Limiting

## Erwartetes Verhalten

Hook: 180/min je Token-Präfix bzw. IP vor Auth (deutsche `{message}`-Antwort); Wrapper: 120/min je Token-Präfix nach Auth (`RATE_LIMITED`-Envelope); beide `Retry-After`; In-Memory, Fenster 60 s

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
| Endpoints | `rateLimitPublicApi`, `publicApi` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-560 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
