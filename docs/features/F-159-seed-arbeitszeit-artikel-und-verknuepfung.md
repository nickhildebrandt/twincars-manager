---
id: F-159
title: Seed Arbeitszeit-Artikel und Verknüpfung
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-005
permission: offen
routes: []
endpoints: ['seedLaborItem']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-159 — Seed Arbeitszeit-Artikel und Verknüpfung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-005** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Seed Arbeitszeit-Artikel und Verknüpfung

## Erwartetes Verhalten

Item `ARBEIT`/„Arbeitszeit"/service/„Std." + Preis 0 (nur neu); `labor_item_id` nur gesetzt wenn NULL.

## Nutzersicht

_Wird mit T-005 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-005 ergänzt._

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
| Endpoints | `seedLaborItem` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-005 ergänzt._

## Quellen

- Inventar: [F-159 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-005 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
