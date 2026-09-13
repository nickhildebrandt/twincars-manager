---
id: F-230
title: Kennzeichen-Versionierung / aktuelles Kennzeichen
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: []
endpoints: ['getEffectiveLicensePlate', 'latestPlateSubquery', 'upsertLicensePlateVersion']
tables: ['vehicle_license_plate_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-230 — Kennzeichen-Versionierung / aktuelles Kennzeichen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kennzeichen-Versionierung / aktuelles Kennzeichen

## Erwartetes Verhalten

Gültig = höchstes `valid_from <= heute`; keine manuelle Pflege von `valid_from`, kein Löschen, keine Zukunftsversionen über UI; Historie im Tab "Historie" als "Kennzeichen <X> ab <Datum>"; Suche/Picker matchen **alle** historischen Kennzeichen

## Nutzersicht

_Wird mit T-012 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-012 ergänzt._

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
| Endpoints | `getEffectiveLicensePlate`, `latestPlateSubquery`, `upsertLicensePlateVersion` |
| Tabellen | `vehicle_license_plate_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-230 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
