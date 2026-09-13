---
id: F-594
title: Automatischer Access-Token-Refresh
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: []
endpoints: ['getValidAccessToken']
tables: ['ebay_credentials']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-594 — Automatischer Access-Token-Refresh

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Automatischer Access-Token-Refresh

## Erwartetes Verhalten

Token gilt bis `accessTokenExpiresAt − 60 s`; sonst `grant_type=refresh_token`, nur Access-Spalten + `updatedAt` aktualisiert (Refresh-Token wird nicht rotiert); kein Konto → „Kein eBay-Konto verbunden. …"

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
| Endpoints | `getValidAccessToken` |
| Tabellen | `ebay_credentials` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-594 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
