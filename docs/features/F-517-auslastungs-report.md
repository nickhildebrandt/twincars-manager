---
id: F-517
title: Auslastungs-Report
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours/reports?tab=utilization']
endpoints: ['utilizationSummaryRemote']
tables: ['time_entries', 'employees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-517 — Auslastungs-Report

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Auslastungs-Report

## Erwartetes Verhalten

Nur `hours`; Zeitraum (Default Monatserster–heute), optional Mitarbeiter; je Mitarbeiter Stunden, "Davon abrechenbar" (= `document_id` gesetzt, inkl. Angebote), "Tage erfasst" (distinct Datum); Summenzeile; Sortierung Nachname, Vorname; Mitarbeiter ohne Einträge fehlen

## Nutzersicht

_Wird mit T-018 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-018 ergänzt._

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
| Routen | `/hours/reports?tab=utilization` |
| Endpoints | `utilizationSummaryRemote` |
| Tabellen | `time_entries`, `employees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-517 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
