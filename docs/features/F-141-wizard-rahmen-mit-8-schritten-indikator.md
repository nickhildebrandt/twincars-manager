---
id: F-141
title: Wizard-Rahmen mit 8 Schritten, Indikator, Zurück/Weiter
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

# F-141 — Wizard-Rahmen mit 8 Schritten, Indikator, Zurück/Weiter

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Wizard-Rahmen mit 8 Schritten, Indikator, Zurück/Weiter

## Erwartetes Verhalten

Schritte Willkommen/Firmendaten/Steuer & Bank/Logo & Anrede/E-Mail (SMTP)/Öffnungszeiten/Administrator/Verifikation; Progress < md, Pill-Steps ≥ md (Kurzlabels); Zurück nie persistierend; Weiter validiert, persistiert den verlassenen Schritt, dann +1.

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

- Inventar: [F-141 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
