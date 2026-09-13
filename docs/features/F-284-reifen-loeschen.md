---
id: F-284
title: Reifen löschen
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-015
permission: offen
routes: ['/tires']
endpoints: ['deleteTireRemote']
tables: ['tires']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-284 — Reifen löschen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-015** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Reifen löschen

## Erwartetes Verhalten

Bestätigungsdialog „Reifen löschen?"; Toast mit Bezeichnung

## Nutzersicht

_Wird mit T-015 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-015 ergänzt._

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
| Routen | `/tires` |
| Endpoints | `deleteTireRemote` |
| Tabellen | `tires` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-015 ergänzt._

## Quellen

- Inventar: [F-284 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-015 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
