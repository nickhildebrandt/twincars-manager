---
id: F-604
title: Whitelist + Rate-Limit für den Compliance-Endpoint
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: []
endpoints: ['hooks.server.ts']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-604 — Whitelist + Rate-Limit für den Compliance-Endpoint

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Whitelist + Rate-Limit für den Compliance-Endpoint

## Erwartetes Verhalten

Nur exakt `/api/ebay/account-deletion` (+ Subpfade) ohne Session; Bucket `public-api:token:<8 Zeichen>` oder `ip:<x-forwarded-for erste IP>`; 120/min + 60 Burst; 429 mit `Retry-After`

## Nutzersicht

_Wird mit T-032 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-032 ergänzt._

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
| Routen | — |
| Endpoints | `hooks.server.ts` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-604 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
