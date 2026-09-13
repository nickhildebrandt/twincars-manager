---
id: F-235
title: Detail: Rechnungen-Tab
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['?tab=rechnungen']
endpoints: ['getVehicleRelatedRemote', 'invoicesPage']
tables: ['documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-235 — Detail: Rechnungen-Tab

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail: Rechnungen-Tab

## Erwartetes Verhalten

Nur `type='invoice'`, `issue_date DESC`, 25/Seite; Spalten Nummer, Status-Badge (`documentStatusLabel`), Rechnungsdatum, Fällig, Brutto; Badge-Zähler im Tab; Leerzustand "Keine Rechnungen für dieses Fahrzeug."; Zeile → `/invoices/<id>`

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
| Routen | `?tab=rechnungen` |
| Endpoints | `getVehicleRelatedRemote`, `invoicesPage` |
| Tabellen | `documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-235 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
