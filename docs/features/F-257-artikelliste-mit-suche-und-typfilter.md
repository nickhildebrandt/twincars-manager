---
id: F-257
title: Artikelliste mit Suche und Typfilter
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-014
permission: offen
routes: ['/items']
endpoints: ['listItemsRemote']
tables: ['items']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-257 — Artikelliste mit Suche und Typfilter

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-014** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Artikelliste mit Suche und Typfilter

## Erwartetes Verhalten

ILIKE über Art-Nr. und Beschreibung; Filter-Tabs Alle/Leistung/Material/Artikel/Durchlaufposten; Tabwechsel setzt Seite 1; Sortierung fest neueste zuerst

## Nutzersicht

_Wird mit T-014 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-014 ergänzt._

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
| Routen | `/items` |
| Endpoints | `listItemsRemote` |
| Tabellen | `items` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-014 ergänzt._

## Quellen

- Inventar: [F-257 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-014 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
