---
id: F-293
title: Einlagerungsliste mit Tabs
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-016
permission: offen
routes: ['/tire-storage']
endpoints: ['listTireStorageRemote']
tables: ['tire_storage', 'customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-293 — Einlagerungsliste mit Tabs

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-016** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Einlagerungsliste mit Tabs

## Erwartetes Verhalten

Tabs „Aktiv eingelagert" und „Abgeholt"; Tabwechsel setzt Seite 1; Spalte „Abgeholt" nur im zweiten Tab

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
| Routen | `/tire-storage` |
| Endpoints | `listTireStorageRemote` |
| Tabellen | `tire_storage`, `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-016 ergänzt._

## Quellen

- Inventar: [F-293 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-016 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
