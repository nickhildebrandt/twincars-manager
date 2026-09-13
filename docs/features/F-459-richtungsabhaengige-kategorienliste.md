---
id: F-459
title: Richtungsabhängige Kategorienliste
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger/new', '/ledger/[id]/edit']
endpoints: ['listCategoriesRemote({direction})']
tables: ['ledger_categories']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-459 — Richtungsabhängige Kategorienliste

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Richtungsabhängige Kategorienliste

## Erwartetes Verhalten

Select zeigt nur Kategorien der gewählten Art, alphabetisch; Umschalten der Art lädt neu; "- wählen -" = keine Kategorie (`categoryId` → `undefined` → `null`)

## Nutzersicht

_Wird mit T-028 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-028 ergänzt._

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
| Routen | `/ledger/new`, `/ledger/[id]/edit` |
| Endpoints | `listCategoriesRemote({direction})` |
| Tabellen | `ledger_categories` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-459 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
