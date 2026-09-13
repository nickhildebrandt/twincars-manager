---
id: F-162
title: Firmenstammdaten bearbeiten (Allgemein)
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/settings']
endpoints: ['getAllSettingsRemote', 'updateCompanyRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-162 — Firmenstammdaten bearbeiten (Allgemein)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Firmenstammdaten bearbeiten (Allgemein)

## Erwartetes Verhalten

15 Felder + Anrede (§6.2); Steuer/Bank optional; IBAN/BIC serverseitig normalisiert/geprüft; Erfolg „Einstellungen gespeichert."; `formDirty` erst nach Erfolg gelöscht.

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
| Endpoints | `getAllSettingsRemote`, `updateCompanyRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-162 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
