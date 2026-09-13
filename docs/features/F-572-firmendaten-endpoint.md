---
id: F-572
title: Firmendaten-Endpoint
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/company']
endpoints: ['handlePublicCompany', 'getSettings', 'listWorkshopHours']
tables: ['company_settings', 'workshop_hours']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-572 — Firmendaten-Endpoint

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Firmendaten-Endpoint

## Erwartetes Verhalten

Name (2×), `tagline: null`, Adresse inkl. Bundesland-Rohwert, Kontakt, Geo (nur wenn beide Koordinaten), 7 Öffnungszeiten mit englischen Wochentagsnamen, `opensAt/closesAt` `HH:MM` oder `null` bei `closed`; Lazy-Inserts fehlender Zeilen

## Nutzersicht

_Wird mit T-031 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-031 ergänzt._

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
| Routen | `/api/public/company` |
| Endpoints | `handlePublicCompany`, `getSettings`, `listWorkshopHours` |
| Tabellen | `company_settings`, `workshop_hours` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-572 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
