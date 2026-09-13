---
id: F-289
title: Reifengrößen-Parser
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-015
permission: offen
routes: []
endpoints: ['parseTireSize']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-289 — Reifengrößen-Parser

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-015** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Reifengrößen-Parser

## Erwartetes Verhalten

akzeptiert `205/55R16`, `205/55 R16`, `205/55 ZR 17`, `205/55D16`; `ZR` wird zu `R` normalisiert

## Nutzersicht

_Wird mit T-015 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-015 ergänzt._

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
| Endpoints | `parseTireSize` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-015 ergänzt._

## Quellen

- Inventar: [F-289 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-015 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
