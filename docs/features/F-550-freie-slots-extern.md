---
id: F-550
title: Freie Slots (extern)
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-031
permission: offen
routes: ['GET /api/public/free-slots']
endpoints: ['findFreeSlots']
tables: ['workshop_hours', 'calendar_entries', 'company_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-550 — Freie Slots (extern)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Freie Slots (extern)

## Erwartetes Verhalten

Parameter/Fehler s. Abschnitt 2; Algorithmus s. Abschnitt 3: 15-min-Raster innerhalb Öffnungszeiten, minus nicht-abgesagte Termine und Schließungen (alle, ohne Kapazität), minus Feiertage; max. 60 Tage; Slots müssen komplett in `[from, to]` liegen; Ausgabe ISO-UTC. Vergangene Slots werden nicht herausgefiltert.

## Nutzersicht

_Wird mit T-031 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-031 ergänzt._

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
| Routen | `GET /api/public/free-slots` |
| Endpoints | `findFreeSlots` |
| Tabellen | `workshop_hours`, `calendar_entries`, `company_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-550 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
