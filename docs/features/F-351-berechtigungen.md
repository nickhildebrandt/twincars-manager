---
id: F-351
title: Berechtigungen
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: []
endpoints: []
tables: ['role_permissions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-351 — Berechtigungen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Berechtigungen

## Erwartetes Verhalten

Modulschlüssel `orders` (Administrator `*`, Werkstattleiter, Mitarbeiter geseedet; Migration 0033 nachgetragen); `pickEmployeesRemote`/`pickItemsRemote` auch mit `orders`; Aufträge-Tabs bei Kunde/Fahrzeug mit `customers|orders` bzw. `vehicles|orders`; Kunden-/Fahrzeug-Picker verlangen `customers` bzw. `vehicles`

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
| Endpoints | — |
| Tabellen | `role_permissions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-351 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
