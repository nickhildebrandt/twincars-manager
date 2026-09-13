---
id: F-568
title: Freie Terminslots
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/free-slots']
endpoints: ['handlePublicFreeSlots', 'findFreeSlots']
tables: ['workshop_hours', 'calendar_entries', 'company_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-568 — Freie Terminslots

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Freie Terminslots

## Erwartetes Verhalten

`from`/`to` Pflicht (ISO), `durationMinutes` Default 30, 1..480; `service` optional (404/400-Prüfung, sonst ohne Wirkung); Bereich ≤ 60 Tage; 15-min-Raster innerhalb Öffnungszeiten (Default Mo–Fr 08–17), abzüglich nicht-stornierter Termine, Schließzeiten, gesetzlicher Feiertage des Bundeslands; Slot voll im Bereich; Zeitzone = Server-Prozess

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
| Routen | `/api/public/free-slots` |
| Endpoints | `handlePublicFreeSlots`, `findFreeSlots` |
| Tabellen | `workshop_hours`, `calendar_entries`, `company_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-568 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
