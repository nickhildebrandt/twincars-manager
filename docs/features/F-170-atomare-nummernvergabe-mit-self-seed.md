---
id: F-170
title: Atomare Nummernvergabe mit Self-Seed
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-006
permission: offen
routes: []
endpoints: ['allocateNumber']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-170 — Atomare Nummernvergabe mit Self-Seed

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-006** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Atomare Nummernvergabe mit Self-Seed

## Erwartetes Verhalten

Ein `UPDATE … RETURNING`; fehlende Zeile wird mit Default-Template angelegt; Rendering `{YYYY}/{YY}/{MM}/{N…}`; kein Jahresreset; unbekannter kind → `{N}`.

## Nutzersicht

_Wird mit T-006 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-006 ergänzt._

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
| Endpoints | `allocateNumber` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-006 ergänzt._

## Quellen

- Inventar: [F-170 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-006 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
