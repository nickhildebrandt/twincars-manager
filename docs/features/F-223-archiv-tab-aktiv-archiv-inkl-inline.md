---
id: F-223
title: Archiv-Tab (Aktiv/Archiv) inkl. Inline-Reaktivieren
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['/vehicles']
endpoints: ['listVehiclesRemote', 'archived:'archived'', 'setVehicleArchivedRemote']
tables: ['vehicles']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-223 — Archiv-Tab (Aktiv/Archiv) inkl. Inline-Reaktivieren

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Archiv-Tab (Aktiv/Archiv) inkl. Inline-Reaktivieren

## Erwartetes Verhalten

Archiv zeigt Kunden- **und** Bestandsfahrzeuge (`kind` ignoriert); Reaktivieren optimistisch ohne Dialog, Toast `Fahrzeug „<plate|id>" reaktiviert.`; Tabs sind `tabs tabs-box` Filter-Tabs, kein `?tab=`

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
| Routen | `/vehicles` |
| Endpoints | `listVehiclesRemote`, `archived:'archived'`, `setVehicleArchivedRemote` |
| Tabellen | `vehicles` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-223 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
