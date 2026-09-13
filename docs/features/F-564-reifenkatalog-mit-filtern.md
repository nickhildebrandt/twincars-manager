---
id: F-564
title: Reifenkatalog mit Filtern
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/tires']
endpoints: ['handlePublicTires', 'listPublicTires']
tables: ['tires', 'tire_price_versions', 'tire_photos']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-564 — Reifenkatalog mit Filtern

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Reifenkatalog mit Filtern

## Erwartetes Verhalten

Nur `online_sellable`; Filter `q` (ILIKE Artikelnr/Marke/Modell), `size` (Slash-Form; unparsebar → leere Liste), `season` (exakt, case-sensitiv), `brand` (exakt), `maxPriceNet` (≥0 sonst 400; Reifen ohne Preis fallen raus); Sortierung `created_at DESC`; keine Pagination; volle EU-Label-Felder, `sizeLabel`, `currentPriceNet`, bis 7 Fotos als Data-URL

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
| Routen | `/api/public/tires` |
| Endpoints | `handlePublicTires`, `listPublicTires` |
| Tabellen | `tires`, `tire_price_versions`, `tire_photos` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-564 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
