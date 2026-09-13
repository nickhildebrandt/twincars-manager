---
id: F-226
title: Kundenfahrzeug anlegen
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['/vehicles/new']
endpoints: ['createVehicleRemote', 'pickCustomersRemote']
tables: ['vehicles', 'vehicle_license_plate_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-226 — Kundenfahrzeug anlegen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kundenfahrzeug anlegen

## Erwartetes Verhalten

Halter Pflicht (Picker, Neu-anlegen-Flow), mind. ein Identifier; Felder: Marke(100), Modell(150), Kennzeichen(20 UI/12 Server), FIN(25 UI/17 Server), Erstzulassung (date), km (0–9.999.999), Nächste HU (date), HSN, TSN, Hubraum (0–99.999), kW (0–9.999), Kraftstoff (Select: Benzin/Diesel/Elektro/Hybrid/LPG), Getriebe (Select: Schaltgetriebe/Automatik), Aufbau(50), Notiz(2000); Kennzeichen → Version `valid_from = heute`; Toast "Fahrzeug angelegt.", Redirect Detail

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
| Routen | `/vehicles/new` |
| Endpoints | `createVehicleRemote`, `pickCustomersRemote` |
| Tabellen | `vehicles`, `vehicle_license_plate_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-226 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
