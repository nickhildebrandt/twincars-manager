---
id: F-332
title: Stammdaten-Karte
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/[id]']
endpoints: ['getWorkOrderRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-332 — Stammdaten-Karte

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Stammdaten-Karte

## Erwartetes Verhalten

`dl` mit Kunde (Link `/customers/{id}` oder "-"), Fahrzeug (Link `/vehicles/{id}`, Label "Kennzeichen · Marke Modell"), Termin (nur wenn `appointmentId`, Link `/calendar/{id}/edit`, Text Termin-Titel oder "Zum Termin"), "Geplant am" (`dd.MM.yyyy` + " ab HH:MM Uhr" oder "-"), Mitarbeiter-Badges oder "-", "Abgeschlossen am" (nur done, `de-DE` medium+short), Beschreibung (`whitespace-pre-line`, nur wenn gesetzt)

## Nutzersicht

_Wird mit T-020 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-020 ergänzt._

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
| Routen | `/orders/[id]` |
| Endpoints | `getWorkOrderRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-332 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
