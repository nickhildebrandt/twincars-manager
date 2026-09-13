---
id: F-590
title: Konfigurationsprüfung über Env
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: []
endpoints: ['missingEbayConfig']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-590 — Konfigurationsprüfung über Env

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Konfigurationsprüfung über Env

## Erwartetes Verhalten

`EBAY_CLIENT_ID`, `EBAY_CERT_ID`, `EBAY_RU_NAME` (getrimmt) müssen gesetzt sein; sonst `configured=false`, `missingConfig` = Liste; `buildAuthorizeUrl` wirft „eBay ist nicht konfiguriert - fehlende Umgebungsvariablen: …" (`ebay-auth-service.ts:67-85`)

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
| Endpoints | `missingEbayConfig` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-590 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
