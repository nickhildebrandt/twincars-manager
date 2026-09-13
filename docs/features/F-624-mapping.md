---
id: F-624
title: Mapping `Mahnungen` → `reminders`
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['reminders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-624 — Mapping `Mahnungen` → `reminders`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `Mahnungen` → `reminders`

## Erwartetes Verhalten

`Rechnungsnummer` Pflicht + auflösbar; `Mahnung` (Datum) Pflicht; `level = NrMahnung ?? 1`; `dueDate = issueDate + 14 Tage`; `documentNumber='LEG-MA-<laufende Nr>'`; `status='sent'`; `Gebuehr` ignoriert; Unique `(invoiceId, level)` nicht abgesichert (B-533)

## Nutzersicht

_Wird mit T-033 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-033 ergänzt._

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
| Tabellen | `reminders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-624 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
