---
id: F-602
title: Compliance: Challenge-Handshake
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: ['GET /api/ebay/account-deletion']
endpoints: ['handleDeletionChallenge']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-602 — Compliance: Challenge-Handshake

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Compliance: Challenge-Handshake

## Erwartetes Verhalten

`challengeResponse = hex(sha256(challengeCode ‖ EBAY_VERIFICATION_TOKEN ‖ endpointUrl))`; `endpointUrl` = `EBAY_DELETION_ENDPOINT_URL` (getrimmt, leer = unset) sonst `origin+pathname`; 503 ohne Token, 400 ohne Code; Info-Log

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
| Routen | `GET /api/ebay/account-deletion` |
| Endpoints | `handleDeletionChallenge` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-602 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
