---
id: F-271
title: Artikel-Picker
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-014
permission: offen
routes: []
endpoints: ['pickItemsRemote']
tables: ['items']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-271 — Artikel-Picker

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-014** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Artikel-Picker

## Erwartetes Verhalten

Serversuche, Kategorie-Filter Leistung vs. Material; liefert aktuellen Preis mit; auch für Recht `orders`

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
| Routen | — |
| Endpoints | `pickItemsRemote` |
| Tabellen | `items` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-014 ergänzt._

## Quellen

- Inventar: [F-271 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-014 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
