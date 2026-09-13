---
id: F-208
title: Kundenzähler
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: []
endpoints: ['countCustomersRemote']
tables: ['customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-208 — Kundenzähler

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kundenzähler

## Erwartetes Verhalten

Anzahl aktiver Kunden; wird bei jeder Mutation refreshed; kein UI-Konsument gefunden

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
| Endpoints | `countCustomersRemote` |
| Tabellen | `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-208 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
