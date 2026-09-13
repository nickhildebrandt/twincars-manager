---
id: F-544
title: Feiertage algorithmisch
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar']
endpoints: ['listCalendarEventsRemote']
tables: ['company_settings.state']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-544 — Feiertage algorithmisch

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Feiertage algorithmisch

## Erwartetes Verhalten

Gauß-Osterformel, Regeltabelle (Abschnitt 3), Bundesland aus Freitext toleranter Resolver, Fallback `'DE'` (9 bundesweite); Memo 64 Einträge; kein Jahreslimit (1583–4099). Feiertage sind reine Anzeige (nicht klickbar) und Blocker in Slots/Arbeitstagen. Kommunale Feiertage nicht abgebildet; keine manuellen Zusatz-/Ausnahmetage.

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
| Tabellen | `company_settings.state` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-544 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
