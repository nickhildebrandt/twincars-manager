---
id: F-535
title: Termin-Status
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar/[id]/edit']
endpoints: []
tables: ['calendar_entries.status']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-535 — Termin-Status

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Termin-Status

## Erwartetes Verhalten

Select Geplant/Abgeschlossen/Abgesagt; `cancelled` → Chip verschwindet aus Grid, blockiert keine Slots, löst keine Kollisionswarnung aus, zählt nicht im Dashboard; `completed` wird wie `scheduled` gerendert (keine visuelle Unterscheidung, `eventClass` default). Kein Status-Übergangs-Regelwerk (jeder Wechsel erlaubt, auch rückwärts).

## Nutzersicht

_Wird mit T-019 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-019 ergänzt._

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
| Routen | `/calendar/[id]/edit` |
| Endpoints | — |
| Tabellen | `calendar_entries.status` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-535 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
