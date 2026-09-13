---
id: F-176
title: Kleinunternehmer-Regelung (§19 UStG)
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/settings/reminders']
endpoints: ['updateReminderSettingsRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-176 — Kleinunternehmer-Regelung (§19 UStG)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kleinunternehmer-Regelung (§19 UStG)

## Erwartetes Verhalten

Flag steuert PDF-Summenblock/Hinweistext und XRechnung; nicht die MwSt-Berechnung von Aufträgen/Public Orders.

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
| Routen | `/settings/reminders` |
| Endpoints | `updateReminderSettingsRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-176 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
