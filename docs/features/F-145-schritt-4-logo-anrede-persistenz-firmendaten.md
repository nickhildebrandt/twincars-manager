---
id: F-145
title: Schritt 4 Logo & Anrede + Persistenz Firmendaten
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/setup']
endpoints: ['saveCompanyData']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-145 — Schritt 4 Logo & Anrede + Persistenz Firmendaten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Schritt 4 Logo & Anrede + Persistenz Firmendaten

## Erwartetes Verhalten

Logo optional (PNG/JPG/SVG, ≤ 5 MB, Toast bei Überschreitung, Vorschau); Anrede Sie/Du (Default Sie); beim Verlassen ein `UPDATE` mit allen Feldern der Schritte 2–4; leere Optionale → NULL; fehlendes Logo → NULL.

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
| Routen | `/setup` |
| Endpoints | `saveCompanyData` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-145 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
