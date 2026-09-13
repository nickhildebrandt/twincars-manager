---
id: F-336
title: Katalog-Picker mit Kategorie
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/[id]']
endpoints: ['pickItemsRemote({category})']
tables: ['items', 'item_price_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-336 — Katalog-Picker mit Kategorie

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Katalog-Picker mit Kategorie

## Erwartetes Verhalten

Arbeitszeit → `services` (kind=service); Material → `articles` (article/material/pass_through); Treffer-Label "{articleNumber} - {description}"; Auswahl setzt Beschreibung + Preis (+ Einheit bei Material); Abwahl leert nur die Picker-Felder; Artwechsel leert Picker und setzt Preis neu

## Nutzersicht

_Wird mit T-020 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-020 ergänzt._

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
| Routen | `/orders/[id]` |
| Endpoints | `pickItemsRemote({category})` |
| Tabellen | `items`, `item_price_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-336 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
