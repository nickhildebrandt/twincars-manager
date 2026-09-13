---
id: F-510
title: Kunde aus Stundenformular anlegen (Creation-Flow)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours/new', '/hours/[id]/edit', '/customers/new']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-510 — Kunde aus Stundenformular anlegen (Creation-Flow)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kunde aus Stundenformular anlegen (Creation-Flow)

## Erwartetes Verhalten

Picker-Header "Neuen Kunden anlegen"; Formular-Draft (alle Felder) in `creationFlow`; Rückkehr stellt Draft her, Kunde vorausgewählt, `formDirty` wieder gesetzt; Cycle-Guard blendet Option aus

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
| Routen | `/hours/new`, `/hours/[id]/edit`, `/customers/new` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-510 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
