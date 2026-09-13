---
id: F-593
title: Token-Austausch und verschlüsselte Ablage (Single-Row)
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: []
endpoints: ['exchangeAuthCode']
tables: ['ebay_credentials']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-593 — Token-Austausch und verschlüsselte Ablage (Single-Row)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Token-Austausch und verschlüsselte Ablage (Single-Row)

## Erwartetes Verhalten

`POST /identity/v1/oauth2/token` Basic-Auth; `refresh_token` Pflicht; Username best-effort; `DELETE` + `INSERT`; Access/Refresh AES-256-GCM `v1:iv:tag:data`; Ablaufzeiten aus `expires_in`/`refresh_token_expires_in`; `scopes=EBAY_SCOPES`; `environment` aktuell

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
| Endpoints | `exchangeAuthCode` |
| Tabellen | `ebay_credentials` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-593 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
