---
id: F-566
title: Leistungskatalog
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/services']
endpoints: ['handlePublicServices', 'listPublicServices']
tables: ['items', 'item_price_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-566 — Leistungskatalog

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Leistungskatalog

## Erwartetes Verhalten

Alle `kind='service'` (inkl. Arbeitszeit-Item), `created_at DESC`, `currentPriceNet`, `onlineBookable`, `unit`, `attributes: {}` (Altlast)

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
| Routen | `/api/public/services` |
| Endpoints | `handlePublicServices`, `listPublicServices` |
| Tabellen | `items`, `item_price_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-566 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
