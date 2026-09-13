---
id: F-099
title: Kombi-Picker Kunde/Fahrzeug mit Halter-Autofill und Kundenfilter
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-009
permission: offen
routes: []
endpoints: ['pickCustomersRemote', 'pickCustomerVehiclesRemote']
tables: ['customers', 'vehicles']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-099 — Kombi-Picker Kunde/Fahrzeug mit Halter-Autofill und Kundenfilter

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-009** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kombi-Picker Kunde/Fahrzeug mit Halter-Autofill und Kundenfilter

## Erwartetes Verhalten

Regeln aus 4.2; `vehicleLocked`; dynamische Dialogtitel/Placeholder/Leertexte; Fahrzeug-Neuanlage nur mit Kunde

## Nutzersicht

_Wird mit T-009 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-009 ergänzt._

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

_Wird mit T-009 ergänzt._

## Quellen

- Inventar: [F-099 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-009 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
