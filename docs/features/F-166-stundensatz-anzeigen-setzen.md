---
id: F-166
title: Stundensatz anzeigen/setzen
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/settings']
endpoints: ['getLaborRateSettingRemote', 'updateLaborRateRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-166 — Stundensatz anzeigen/setzen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Stundensatz anzeigen/setzen

## Erwartetes Verhalten

Anzeige „Aktuell: x,xx €"/„nicht gesetzt"; Save schreibt Preisversion `valid_from=heute` (Same-Day-Update); ≤ 0 → Toast; ohne Item: Hinweis „Es ist kein Arbeitszeit-Artikel hinterlegt." (Server 409).

## Nutzersicht

_Wird mit T-010 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-010 ergänzt._

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
| Routen | `/settings` |
| Endpoints | `getLaborRateSettingRemote`, `updateLaborRateRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-166 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
