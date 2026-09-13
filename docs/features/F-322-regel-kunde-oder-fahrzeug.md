---
id: F-322
title: Regel Kunde ODER Fahrzeug
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: []
endpoints: ['createWorkOrderRemote', 'updateWorkOrderRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-322 — Regel Kunde ODER Fahrzeug

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Regel Kunde ODER Fahrzeug

## Erwartetes Verhalten

Beide optional, mindestens eins Pflicht; dreifach geprüft (Client-`check` → `_form`; Remote-Schnellpfad; Service gegen effektiven Post-Patch-Zustand); identischer deutscher Text; Termin-Aufträge ausgenommen

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
| Endpoints | `createWorkOrderRemote`, `updateWorkOrderRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-322 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
