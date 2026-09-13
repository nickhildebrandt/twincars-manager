---
id: F-024
title: Unsaved-Changes-Guard (In-App + beforeunload)
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-008
permission: offen
routes: []
endpoints: ['formDirty']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-024 — Unsaved-Changes-Guard (In-App + beforeunload)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-008** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Unsaved-Changes-Guard (In-App + beforeunload)

## Erwartetes Verhalten

ConfirmDialog „Ungespeicherte Änderungen“ … „Verwerfen“/„Bleiben“; `clear()` vor Retarget-`goto`

## Nutzersicht

_Wird mit T-008 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-008 ergänzt._

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
| Endpoints | `formDirty` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-008 ergänzt._

## Quellen

- Inventar: [F-024 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-008 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
