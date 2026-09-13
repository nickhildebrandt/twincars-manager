---
id: F-149
title: Schritt 8 Verifikation mit Bearbeiten-Sprüngen
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/setup']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-149 — Schritt 8 Verifikation mit Bearbeiten-Sprüngen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Schritt 8 Verifikation mit Bearbeiten-Sprüngen

## Erwartetes Verhalten

6 Karten mit allen erfassten Werten; „Bearbeiten" springt zum Schritt (Admin-Karte gesperrt nach Anlage); Rückweg über „Weiter" persistiert 4–6 erneut.

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
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-149 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
