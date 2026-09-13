---
id: F-601
title: Tabelle „Importierte Angebote' mit Suche, Status-Filter, Pagination 25, Row-Click
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: ['/settings/ebay']
endpoints: ['listEbayListingsRemote']
tables: ['ebay_listings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-601 — Tabelle „Importierte Angebote" mit Suche, Status-Filter, Pagination 25, Row-Click

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Tabelle „Importierte Angebote" mit Suche, Status-Filter, Pagination 25, Row-Click

## Erwartetes Verhalten

Suche `ilike %q%` auf `title`/`sku`/`ebay_item_id` (Debounce 250 ms, max 200 Zeichen); Filter Alle/Aktiv/Beendet; Filteränderung → Seite 1; Sortierung `status ASC, title ASC`; nur aktuelles `environment`; Spalten Angebot (Thumbnail+Titel+SKU), eBay-Artikelnr., Preis, Verfügbar, Verkauft, Status-Badge (`badge-success` Aktiv / `badge-ghost` Beendet), Läuft bis; Row-Click `window.open(viewItemUrl,'_blank','noopener')`; stale-while-revalidate über `lastResult`; EmptyState-Varianten

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
| Endpoints | `listEbayListingsRemote` |
| Tabellen | `ebay_listings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-601 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
