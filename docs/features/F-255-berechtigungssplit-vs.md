---
id: F-255
title: Berechtigungssplit `vehicles` vs. `inventory`
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: []
endpoints: ['requirePermission']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-255 — Berechtigungssplit `vehicles` vs. `inventory`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Berechtigungssplit `vehicles` vs. `inventory`

## Erwartetes Verhalten

`vehicles`: Liste/Detail/Anlage/Edit/Fotos/Dokumente/Schild/Archiv/Löschen; `inventory`: Bestandsliste, Inventory-Picker, Ankauf-Command, Rechnungs-Vorbelegung; `orders` darf Aufträge-Tab-Daten lesen; inventory-only Nutzer kann Detailseite nicht öffnen (403 `getVehicleRemote`)

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
| Routen | — |
| Endpoints | `requirePermission` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-255 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
