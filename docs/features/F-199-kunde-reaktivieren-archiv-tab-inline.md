---
id: F-199
title: Kunde reaktivieren (Archiv-Tab, inline)
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['/customers']
endpoints: ['setCustomerArchivedRemote']
tables: ['customers.archived']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-199 — Kunde reaktivieren (Archiv-Tab, inline)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kunde reaktivieren (Archiv-Tab, inline)

## Erwartetes Verhalten

Ohne Bestätigung, optimistisch (Zeile verschwindet), Toast `Kunde „…" reaktiviert.`

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
| Routen | `/customers` |
| Endpoints | `setCustomerArchivedRemote` |
| Tabellen | `customers.archived` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-199 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
