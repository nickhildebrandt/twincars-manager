---
id: F-147
title: Schritt 6 Öffnungszeiten (7 Wochentage)
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/setup']
endpoints: ['listWorkshopHoursForSetup', 'saveWorkshopHoursForSetup']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-147 — Schritt 6 Öffnungszeiten (7 Wochentage)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Schritt 6 Öffnungszeiten (7 Wochentage)

## Erwartetes Verhalten

Zeilen aus DB (Seed Mo–Fr 08–17, Sa/So geschlossen); Toggle geschlossen; Client prüft HH:MM und Schließen > Öffnen; Server nur HH:MM; alle 7 Zeilen sequentiell upsert.

## Nutzersicht

_Wird mit T-010 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-010 ergänzt._

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
| Routen | `/setup` |
| Endpoints | `listWorkshopHoursForSetup`, `saveWorkshopHoursForSetup` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-147 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
