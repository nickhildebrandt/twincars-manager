---
id: F-286
title: Reifen-Preisversionen und Verlauf
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-015
permission: offen
routes: ['/tires/[id]']
endpoints: ['upsertTirePriceRemote', 'getTirePriceHistoryRemote']
tables: ['tire_price_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-286 — Reifen-Preisversionen und Verlauf

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-015** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Reifen-Preisversionen und Verlauf

## Erwartetes Verhalten

Gültigkeitsdatum frei wählbar; Verlauf paginiert

## Nutzersicht

_Wird mit T-015 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-015 ergänzt._

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
| Routen | `/tires/[id]` |
| Endpoints | `upsertTirePriceRemote`, `getTirePriceHistoryRemote` |
| Tabellen | `tire_price_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-015 ergänzt._

## Quellen

- Inventar: [F-286 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-015 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
