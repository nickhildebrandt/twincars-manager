---
id: F-588
title: eBay-Status-Karte mit drei Zuständen (nicht konfiguriert / getrennt / verbunden)
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: ['/settings/ebay']
endpoints: ['getEbayStatusRemote']
tables: ['ebay_credentials']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-588 — eBay-Status-Karte mit drei Zuständen (nicht konfiguriert / getrennt / verbunden)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

eBay-Status-Karte mit drei Zuständen (nicht konfiguriert / getrennt / verbunden)

## Erwartetes Verhalten

Nicht konfiguriert → Warn-Alert mit fehlenden Env-Keys, kein Button; getrennt → Erklärtext + „Mit eBay verbinden"; verbunden → Success-Alert „Verbunden als <username> seit <Datum>", `dl` mit „Access-Token gültig bis … (wird automatisch erneuert)" und „Verbindung läuft ab <refreshTokenExpiresAt>", Button „Verbindung trennen". Datumsformat `toLocaleString('de-DE')`, `-` bei null (`+page.svelte:70-71,177-247`)

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
| Tabellen | `ebay_credentials` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-588 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
