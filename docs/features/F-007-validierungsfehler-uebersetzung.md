---
id: F-007
title: Validierungsfehler-Übersetzung
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-004
permission: offen
routes: []
endpoints: ['handleValidationError', 'FIELD_LABELS']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-007 — Validierungsfehler-Übersetzung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-004** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Validierungsfehler-Übersetzung

## Erwartetes Verhalten

Nur erste Issue; `Ungültige Eingabe für „<Label>“: <Meldung>`; `values`-Wrapper übersprungen; Array-Index → „(Position N)“ 1-basiert; Meldungen ohne Umlaut → „Bitte prüfen Sie Ihre Eingabe.“

## Nutzersicht

_Wird mit T-004 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-004 ergänzt._

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
| Endpoints | `handleValidationError`, `FIELD_LABELS` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-004 ergänzt._

## Quellen

- Inventar: [F-007 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-004 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
