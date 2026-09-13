---
id: F-406
title: Nummernkreise (atomar, selbstseedend)
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-006
permission: offen
routes: []
endpoints: ['allocateNumber']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-406 — Nummernkreise (atomar, selbstseedend)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-006** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Nummernkreise (atomar, selbstseedend)

## Erwartetes Verhalten

Single-Statement UPDATE…RETURNING; Templates `{N}`/`S-{N}`/`ZE-{YYYY}-{NNNN}`; kein Jahres-Reset; Lücken bei Folgefehlern möglich

## Nutzersicht

_Wird mit T-006 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-006 ergänzt._

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
| Endpoints | `allocateNumber` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-006 ergänzt._

## Quellen

- Inventar: [F-406 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-006 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
