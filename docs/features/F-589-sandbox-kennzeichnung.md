---
id: F-589
title: Sandbox-Kennzeichnung
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: ['/settings/ebay']
endpoints: ['getEbayStatusRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-589 — Sandbox-Kennzeichnung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Sandbox-Kennzeichnung

## Erwartetes Verhalten

Badge „Sandbox" (`badge-warning`) neben dem Kartentitel, wenn `EBAY_ENV=sandbox` (`:182-184`); alle Hosts/URLs wechseln auf `*.sandbox.ebay.com` (`ebay-auth-service.ts:45-57`, `ebay-listing-service.ts:75-78`)

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
| Routen | `/settings/ebay` |
| Endpoints | `getEbayStatusRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-589 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
