---
id: F-378
title: Angebotslebenszyklus-CTA
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-021
permission: offen
routes: ['/offers/[id]']
endpoints: ['sendOfferRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-378 — Angebotslebenszyklus-CTA

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-021** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Angebotslebenszyklus-CTA

## Erwartetes Verhalten

`created|draft` → „Versenden" (E-Mail mit PDF, Status sent); `sent` → „In Rechnung umwandeln" (Link); `converted|cancelled` → kein CTA

## Nutzersicht

_Wird mit T-021 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-021 ergänzt._

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
| Routen | `/offers/[id]` |
| Endpoints | `sendOfferRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-021 ergänzt._

## Quellen

- Inventar: [F-378 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-021 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
