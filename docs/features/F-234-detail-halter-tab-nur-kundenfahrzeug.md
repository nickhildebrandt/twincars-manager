---
id: F-234
title: Detail: Halter-Tab (nur Kundenfahrzeug)
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['?tab=halter']
endpoints: ['getVehicleRelatedRemote']
tables: ['customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-234 — Detail: Halter-Tab (nur Kundenfahrzeug)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail: Halter-Tab (nur Kundenfahrzeug)

## Erwartetes Verhalten

`CompactCustomerCard` (Nummer, Firma/Name, Telefon, E-Mail, Link "Zum Kunden"); Tab verschwindet nach Ankauf

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
| Routen | `?tab=halter` |
| Endpoints | `getVehicleRelatedRemote` |
| Tabellen | `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-234 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
