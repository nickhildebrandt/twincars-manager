---
id: F-224
title: Fahrzeug löschen mit Verknüpfungs-Guard
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['/vehicles']
endpoints: ['deleteVehicleRemote']
tables: ['vehicles', 'documents', 'work_orders', 'tire_storage']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-224 — Fahrzeug löschen mit Verknüpfungs-Guard

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Fahrzeug löschen mit Verknüpfungs-Guard

## Erwartetes Verhalten

ConfirmDialog (danger); Server verweigert 409 mit deutschen Zählungen (Belege/Aufträge/Reifeneinlagerungen); sonst Hard-Delete mit Cascade auf Fotos, Dokumente, Plate-Historie, Ankäufe, Verkäufe, Listings; optimistische Entfernung mit Rückkehr bei Fehler

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
| Endpoints | `deleteVehicleRemote` |
| Tabellen | `vehicles`, `documents`, `work_orders`, `tire_storage` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-224 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
