---
id: F-004
title: Drossel Public-API + eBay-Compliance
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-031
permission: offen
routes: ['/api/public/*', '/api/ebay/account-deletion']
endpoints: ['rateLimitPublicApi']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-004 — Drossel Public-API + eBay-Compliance

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Drossel Public-API + eBay-Compliance

## Erwartetes Verhalten

120/min + 60 Burst je `token:<8>`/`ip:<ip>`; 429 „Zu viele Anfragen. Bitte reduzieren Sie die Aufrufrate.“

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
| Routen | `/api/public/*`, `/api/ebay/account-deletion` |
| Endpoints | `rateLimitPublicApi` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-004 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
