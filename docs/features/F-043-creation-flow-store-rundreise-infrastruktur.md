---
id: F-043
title: Creation-Flow-Store (Rundreise-Infrastruktur)
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-009
permission: offen
routes: ['/customers/new', '/vehicles/new', '/employees/new']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-043 — Creation-Flow-Store (Rundreise-Infrastruktur)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-009** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Creation-Flow-Store (Rundreise-Infrastruktur)

## Erwartetes Verhalten

Stack, sessionStorage-Spiegel, 1-h-Verfall, URL-genaue Einmal-Rückgabe, Zyklus-Guard, `leafInitial`/`holder`

## Nutzersicht

_Wird mit T-009 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-009 ergänzt._

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
| Routen | `/customers/new`, `/vehicles/new`, `/employees/new` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-009 ergänzt._

## Quellen

- Inventar: [F-043 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-009 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
