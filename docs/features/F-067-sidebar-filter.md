---
id: F-067
title: Sidebar-Filter
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-008
permission: offen
routes: []
endpoints: ['getCurrentUserRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-067 — Sidebar-Filter

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-008** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Sidebar-Filter

## Erwartetes Verhalten

Items mit `permission` nur bei exaktem Key oder `*`; leere Gruppen fallen weg; ohne Rechte nur „Start"; „Stunden" hängt an `hours:write_own`

## Nutzersicht

_Wird mit T-008 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-008 ergänzt._

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
| Endpoints | `getCurrentUserRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-008 ergänzt._

## Quellen

- Inventar: [F-067 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-008 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
