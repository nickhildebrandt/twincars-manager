---
id: F-256
title: Single-Flight-Refresh nach Mutationen
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: []
endpoints: ['requested(...).refreshAll()', '.updates(...)', 'query.refresh()']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-256 — Single-Flight-Refresh nach Mutationen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Single-Flight-Refresh nach Mutationen

## Erwartetes Verhalten

Liste: optimistische Overrides bei Delete/Reaktivieren; Detail: Ankauf schickt drei Query-Instanzen mit; Archiv/Update refreshen `getVehicleRemote({id})` serverseitig; Fotos/Dokumente refreshen imperativ per `.run()`

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
| Routen | — |
| Endpoints | `requested(...).refreshAll()`, `.updates(...)`, `query.refresh()` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-256 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
