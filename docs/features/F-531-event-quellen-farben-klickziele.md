---
id: F-531
title: Event-Quellen, Farben, Klickziele
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar']
endpoints: ['listCalendarEventsRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-531 — Event-Quellen, Farben, Klickziele

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Event-Quellen, Farben, Klickziele

## Erwartetes Verhalten

8 Kinds: `appointment` (primary, Titel + „ · Vorname Nachname", nur wenn nicht `cancelled` und ohne Auftrag), `business_closure` (base-300, „Betriebsschließung - <Titel>", jeder Tag), `employee_vacation`/`employee_sick`/`employee_other` (info/warning/neutral, „Urlaub/Krankheit/Abwesenheit · Name", jeder Tag, nicht `cancelled`), `public_holiday` (error, Name, nicht klickbar), `hu_due` (warning, „HU: Marke Modell · Kennzeichen", nur `archived=false`), `work_order` (secondary; `done` → gedimmt + durchgestrichen; alle Status). Klick: Termin/Schließung → Edit, HU → Fahrzeug, Auftrag → Auftrag, Abwesenheit → Mitarbeiter. Keine Uhrzeiten, keine Legende.

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
| Routen | `/calendar` |
| Endpoints | `listCalendarEventsRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-531 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
