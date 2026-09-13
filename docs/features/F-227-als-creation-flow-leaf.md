---
id: F-227
title: `/vehicles/new` als Creation-Flow-Leaf
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['/vehicles/new']
endpoints: ['creationFlow']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-227 — `/vehicles/new` als Creation-Flow-Leaf

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

`/vehicles/new` als Creation-Flow-Leaf

## Erwartetes Verhalten

Info-Alert, Halter aus `leafInitial` vorbelegt, `finish({id,label,holder})` → Rücksprung mit Auto-Select; Cancel → Rücksprung ohne Auswahl

## Nutzersicht

_Wird mit T-012 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-012 ergänzt._

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
| Routen | `/vehicles/new` |
| Endpoints | `creationFlow` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-227 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
