---
id: F-135
title: MultiSelect (client-seitig) für Benutzerrollen
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-034
permission: offen
routes: ['settings/users/new', '…/[id]/edit']
endpoints: []
tables: ['roles']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-135 — MultiSelect (client-seitig) für Benutzerrollen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-034** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

MultiSelect (client-seitig) für Benutzerrollen

## Erwartetes Verhalten

Chips, Filter, Toggle, Esc/Outside-Close, `emptyHint`

## Nutzersicht

_Wird mit T-034 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-034 ergänzt._

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
| Routen | `settings/users/new`, `…/[id]/edit` |
| Endpoints | — |
| Tabellen | `roles` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-034 ergänzt._

## Quellen

- Inventar: [F-135 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-034 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
