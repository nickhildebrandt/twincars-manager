---
id: F-347
title: Rechnungshistorie-Karte
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/[id]']
endpoints: ['listOrderInvoices']
tables: ['documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-347 — Rechnungshistorie-Karte

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rechnungshistorie-Karte

## Erwartetes Verhalten

Karte "Rechnungen" mit Untertitel "Alle zu diesem Auftrag erstellten Rechnungen — inklusive stornierter Belege und Stornorechnungen."; Spalten Nummer/Datum/Status-Badge (`documentStatusLabel`: Angelegt, Versendet, Bezahlt, Storniert, Stornorechnung…)/Brutto; Zeilen klickbar → `/invoices/{id}`; älteste zuerst; nur sichtbar wenn ≥ 1

## Nutzersicht

_Wird mit T-020 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-020 ergänzt._

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
| Routen | `/orders/[id]` |
| Endpoints | `listOrderInvoices` |
| Tabellen | `documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-347 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
