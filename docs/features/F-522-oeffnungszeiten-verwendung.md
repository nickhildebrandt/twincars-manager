---
id: F-522
title: Öffnungszeiten-Verwendung
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/api/public/free-slots', '/api/public/company']
endpoints: ['public-api-service', 'company/endpoint']
tables: ['workshop_hours']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-522 — Öffnungszeiten-Verwendung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Öffnungszeiten-Verwendung

## Erwartetes Verhalten

Free-Slot-Raster je Tag aus `opensAt/closesAt`, geschlossene Tage und Feiertage ausgelassen; **nicht** verwendet für Soll-Stunden, Abwesenheits-Arbeitstage oder Zeiterfassung

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
| Routen | `/api/public/free-slots`, `/api/public/company` |
| Endpoints | `public-api-service`, `company/endpoint` |
| Tabellen | `workshop_hours` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-522 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
