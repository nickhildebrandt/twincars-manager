---
id: F-592
title: OAuth-Callback verarbeiten
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: ['GET /api/ebay/oauth/callback']
endpoints: ['handleOauthCallback']
tables: ['ebay_credentials']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-592 — OAuth-Callback verarbeiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

OAuth-Callback verarbeiten

## Erwartetes Verhalten

Session-pflichtig; Reihenfolge: kein `code` → `declined`; `state` fehlt/ungültig/abgelaufen → `state`; Exchange wirft → `exchange`; sonst `connected=1`; immer `303 /settings/ebay?<flag>`; Details nur im Server-Log

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
| Routen | `GET /api/ebay/oauth/callback` |
| Endpoints | `handleOauthCallback` |
| Tabellen | `ebay_credentials` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-592 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
