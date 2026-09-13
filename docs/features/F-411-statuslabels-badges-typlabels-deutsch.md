---
id: F-411
title: Statuslabels/Badges/Typlabels (Deutsch)
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-006
permission: offen
routes: []
endpoints: ['status-labels.ts']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-411 — Statuslabels/Badges/Typlabels (Deutsch)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-006** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Statuslabels/Badges/Typlabels (Deutsch)

## Erwartetes Verhalten

`draft|created` → Angelegt, `sent` → Versendet, `paid` → Bezahlt, `cancelled` → Storniert, `storno` → Stornorechnung, `converted` → In Rechnung überführt, `open`/`overdue` Alias

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
| Endpoints | `status-labels.ts` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-006 ergänzt._

## Quellen

- Inventar: [F-411 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-006 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
