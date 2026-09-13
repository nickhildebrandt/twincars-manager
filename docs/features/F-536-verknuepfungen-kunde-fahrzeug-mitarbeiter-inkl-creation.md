---
id: F-536
title: Verknüpfungen Kunde/Fahrzeug/Mitarbeiter inkl. Creation-Flow
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar/new', '/calendar/[id]/edit']
endpoints: ['pickCustomersRemote', 'customers', 'pickCustomerVehiclesRemote', 'vehicles', 'pickEmployeesRemote']
tables: ['customers', 'vehicles', 'employees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-536 — Verknüpfungen Kunde/Fahrzeug/Mitarbeiter inkl. Creation-Flow

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Verknüpfungen Kunde/Fahrzeug/Mitarbeiter inkl. Creation-Flow

## Erwartetes Verhalten

`CustomerVehiclePicker`: Fahrzeug zuerst → Halter wird Kunde; Kunde zuerst → Fahrzeugsuche eingeschränkt; „Neu anlegen" im Picker-Header → Draft speichern → `/customers/new` bzw. `/vehicles/new` (nur mit Kunde, Halter vorbelegt) → Rückkehr mit Auto-Select und Halter-Sync; Cycle-Guard. Mitarbeiter über `SearchablePicker` „Mitarbeiter auswählen" (kein „Neu anlegen"). Alle optional. Server prüft nicht, dass Fahrzeug zum Kunden gehört.

## Nutzersicht

_Wird mit T-019 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-019 ergänzt._

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
| Routen | `/calendar/new`, `/calendar/[id]/edit` |
| Endpoints | `pickCustomersRemote`, `customers`, `pickCustomerVehiclesRemote`, `vehicles`, `pickEmployeesRemote` |
| Tabellen | `customers`, `vehicles`, `employees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-536 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
