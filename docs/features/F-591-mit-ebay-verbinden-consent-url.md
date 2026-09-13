---
id: F-591
title: Mit eBay verbinden (Consent-URL)
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: ['/settings/ebay']
endpoints: ['startEbayConnectRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-591 — Mit eBay verbinden (Consent-URL)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mit eBay verbinden (Consent-URL)

## Erwartetes Verhalten

Command mintet je Klick frischen `state` (`<ts>.<nonce>.<hmac>`, 10 min TTL); URL `https://auth[.sandbox].ebay.com/oauth2/authorize` mit `client_id`, `redirect_uri=<RuName>`, `response_type=code`, `scope="…sell.inventory …commerce.identity.readonly"`, `state`, `locale=de-DE`; Client setzt `window.location.href`

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
| Endpoints | `startEbayConnectRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-591 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
