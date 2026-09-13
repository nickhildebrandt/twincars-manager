---
id: F-194
title: Detail: Tab Fahrzeuge
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['/customers/[id]?tab=fahrzeuge']
endpoints: ['getCustomerRelatedRemote']
tables: ['vehicles', 'vehicle_license_plate_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-194 — Detail: Tab Fahrzeuge

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail: Tab Fahrzeuge

## Erwartetes Verhalten

Alle Fahrzeuge mit `customerId` (inkl. archivierte, unmarkiert), neueste zuerst, unbegrenzt; Badge = Anzahl; Klick → Fahrzeugdetail; Leerzustand-Text

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
| Routen | `/customers/[id]?tab=fahrzeuge` |
| Endpoints | `getCustomerRelatedRemote` |
| Tabellen | `vehicles`, `vehicle_license_plate_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-194 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
