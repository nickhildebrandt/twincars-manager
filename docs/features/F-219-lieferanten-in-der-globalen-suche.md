---
id: F-219
title: Lieferanten in der globalen Suche
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: []
endpoints: ['search.remote.ts']
tables: ['suppliers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-219 — Lieferanten in der globalen Suche

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Lieferanten in der globalen Suche

## Erwartetes Verhalten

Aktive; ILIKE name/legacySupplierNumber/city/email/phone; nur mit `suppliers`-Recht

## Nutzersicht

_Wird mit T-011 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-011 ergänzt._

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
| Endpoints | `search.remote.ts` |
| Tabellen | `suppliers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-219 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
