---
id: F-275
title: Reifenliste mit Suche und Saisonfilter
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-016
permission: offen
routes: ['/tires']
endpoints: ['listTiresRemote']
tables: ['tires']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-275 — Reifenliste mit Suche und Saisonfilter

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-016** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Reifenliste mit Suche und Saisonfilter

## Erwartetes Verhalten

ILIKE über Art-Nr., Marke, Modell, EAN; zusätzlich exakte Größensuche, wenn die Eingabe wie `205/55R16` aussieht; Tabs Alle/Sommer/Winter/Ganzjahres

## Nutzersicht

_Wird mit T-016 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-016 ergänzt._

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
| Routen | `/tires` |
| Endpoints | `listTiresRemote` |
| Tabellen | `tires` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-016 ergänzt._

## Quellen

- Inventar: [F-275 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-016 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
