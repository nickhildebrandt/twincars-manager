---
id: F-207
title: Kunden in der globalen Suche
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: []
endpoints: ['search.remote.ts']
tables: ['customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-207 — Kunden in der globalen Suche

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kunden in der globalen Suche

## Erwartetes Verhalten

Aktive Kunden, ILIKE über 7 Spalten, Sublabel `Nummer · E-Mail · Ort`; nur mit `customers`-Recht

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
| Tabellen | `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-207 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
