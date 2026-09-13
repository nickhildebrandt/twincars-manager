---
id: F-203
title: Opt-ins Newsletter / Reifenwechsel-Erinnerung
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: []
endpoints: ['create/updateCustomerRemote']
tables: ['customers.wants_broadcast', 'wants_tire_reminders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-203 — Opt-ins Newsletter / Reifenwechsel-Erinnerung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Opt-ins Newsletter / Reifenwechsel-Erinnerung

## Erwartetes Verhalten

Checkboxen in beiden Kundenarten; Default false; Verwendung durch Mailings bzw. Reifen-Erinnerungsjob (nur mit aktiver Einlagerung + E-Mail)

## Nutzersicht

_Wird mit T-011 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-011 ergänzt._

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
| Endpoints | `create/updateCustomerRemote` |
| Tabellen | `customers.wants_broadcast`, `wants_tire_reminders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-203 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
