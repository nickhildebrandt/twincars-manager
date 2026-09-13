---
id: F-105
title: Artikel-Picker mit Kategorie-Filter und aktuellem Preis
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-009
permission: offen
routes: []
endpoints: ['pickItemsRemote']
tables: ['items', 'item_price_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-105 — Artikel-Picker mit Kategorie-Filter und aktuellem Preis

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-009** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Artikel-Picker mit Kategorie-Filter und aktuellem Preis

## Erwartetes Verhalten

`category all/services/articles`; Label `Artikelnr - Beschreibung`; `unitPriceNet` aus Preisversionen; **kein** Archivfilter

## Nutzersicht

_Wird mit T-009 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-009 ergänzt._

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
| Endpoints | `pickItemsRemote` |
| Tabellen | `items`, `item_price_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-009 ergänzt._

## Quellen

- Inventar: [F-105 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-009 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
