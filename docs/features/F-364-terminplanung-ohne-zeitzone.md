---
id: F-364
title: Terminplanung ohne Zeitzone
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: []
endpoints: []
tables: ['work_orders.scheduled_date/scheduled_time']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-364 — Terminplanung ohne Zeitzone

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Terminplanung ohne Zeitzone

## Erwartetes Verhalten

Datum + optionale `HH:MM` als Wandzeit ohne TZ; Zeit ohne Datum wird verworfen (Client und Service); Datum löschen löscht Zeit; Termin-Ableitung: allDay → UTC-Datum, sonst server-lokale Getter

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
| Routen | — |
| Endpoints | — |
| Tabellen | `work_orders.scheduled_date/scheduled_time` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-364 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
