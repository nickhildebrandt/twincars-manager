---
id: F-205
title: Kombinierter Kunde/Fahrzeug-Picker
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: []
endpoints: ['pickCustomersRemote', 'pickCustomerVehiclesRemote']
tables: ['customers', 'vehicles']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-205 — Kombinierter Kunde/Fahrzeug-Picker

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kombinierter Kunde/Fahrzeug-Picker

## Erwartetes Verhalten

Fahrzeug → Halter automatisch; Kunde → Fahrzeugsuche gefiltert, fremdes Fahrzeug gelöscht; `vehicleLocked`; Fahrzeug-Neuanlage nur mit Kunde

## Nutzersicht

_Wird mit T-011 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-011 ergänzt._

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
| Endpoints | `pickCustomersRemote`, `pickCustomerVehiclesRemote` |
| Tabellen | `customers`, `vehicles` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-205 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
