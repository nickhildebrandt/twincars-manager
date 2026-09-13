---
id: F-155
title: Seed Mail-Vorlagen (8)
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-005
permission: offen
routes: []
endpoints: ['seedDefaults']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-155 — Seed Mail-Vorlagen (8)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-005** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Seed Mail-Vorlagen (8)

## Erwartetes Verhalten

Keys invoice, cost_estimate, offer, order_confirmation, reminder_1, tire_reminder, appointment_confirmation, mailing; `is_custom=false`; nie überschrieben (ON CONFLICT DO NOTHING).

## Nutzersicht

_Wird mit T-005 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-005 ergänzt._

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
| Endpoints | `seedDefaults` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-005 ergänzt._

## Quellen

- Inventar: [F-155 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-005 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
