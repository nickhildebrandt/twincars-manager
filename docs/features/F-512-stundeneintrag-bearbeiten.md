---
id: F-512
title: Stundeneintrag bearbeiten
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours/[id]/edit']
endpoints: ['updateTimeEntryRemote']
tables: ['time_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-512 — Stundeneintrag bearbeiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Stundeneintrag bearbeiten

## Erwartetes Verhalten

Formular vorbefüllt (Link-Art aus gesetztem Feld); Self-Service: Mitarbeiter fest; order-derived: Hinweis + Auftragslink statt Formular; Erfolg → Toast → Detail

## Nutzersicht

_Wird mit T-018 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-018 ergänzt._

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
| Routen | `/hours/[id]/edit` |
| Endpoints | `updateTimeEntryRemote` |
| Tabellen | `time_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-512 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
