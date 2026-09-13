---
id: F-558
title: Einheitliches JSON-Envelope und Fehlercodes
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/*']
endpoints: ['ok', 'fail', 'codeForStatus']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-558 — Einheitliches JSON-Envelope und Fehlercodes

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Einheitliches JSON-Envelope und Fehlercodes

## Erwartetes Verhalten

Erfolg `{ data }`, Fehler `{ error: { code, message } }` mit `BAD_REQUEST/UNAUTHORIZED/FORBIDDEN/NOT_FOUND/CONFLICT/UNPROCESSABLE_ENTITY/RATE_LIMITED/INTERNAL_ERROR`; unerwartete Fehler → 500 ohne Details; Meldungen überwiegend Englisch

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
| Endpoints | `ok`, `fail`, `codeForStatus` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-558 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
