---
id: F-232
title: Detail: Übersicht (Stammdaten, Technik, Notiz)
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['/vehicles/[id]?tab=uebersicht']
endpoints: ['getVehicleRemote']
tables: ['vehicles']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-232 — Detail: Übersicht (Stammdaten, Technik, Notiz)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail: Übersicht (Stammdaten, Technik, Notiz)

## Erwartetes Verhalten

Stammdaten: Marke, Modell, Kennzeichen, FIN, Erstzulassung (ISO roh), km-Stand (de-DE + " km", 0 → "-"), Nächste HU (ISO roh), Vorbesitzer-Link (nur wenn gesetzt); Technik: HSN/TSN, Hubraum, kW, Kraftstoff, Getriebe, Aufbau; Notiz-Karte nur wenn vorhanden; **nicht** angezeigt: `nextAu`, `colorCode`, `engineNumber`, `legacyVehicleId`, Zeitstempel

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
| Routen | `/vehicles/[id]?tab=uebersicht` |
| Endpoints | `getVehicleRemote` |
| Tabellen | `vehicles` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-232 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
