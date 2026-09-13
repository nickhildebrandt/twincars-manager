---
id: F-315
title: Kanban-Karte
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-315 — Kanban-Karte

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kanban-Karte

## Erwartetes Verhalten

Auftragsnummer (mono), Titel, "Kunde · Kennzeichen" (nur wenn vorhanden), Assignee-Badges, Klick/Enter/Space → `/orders/{id}`; Aktionsbereich stoppt Propagation

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
| Routen | `/orders` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-315 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
