---
id: F-263
title: Kennzeichen „online buchbar'
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-014
permission: offen
routes: ['/items/new', '/items/[id]/edit']
endpoints: ['createItemRemote']
tables: ['items.online_bookable']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-263 — Kennzeichen „online buchbar"

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-014** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kennzeichen „online buchbar"

## Erwartetes Verhalten

nur für Leistungen sinnvoll; einziges Tor für die Online-Terminbuchung

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
| Routen | `/items/new`, `/items/[id]/edit` |
| Endpoints | `createItemRemote` |
| Tabellen | `items.online_bookable` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-014 ergänzt._

## Quellen

- Inventar: [F-263 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-014 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
