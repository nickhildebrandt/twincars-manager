---
id: F-178
title: Kundenliste (Tabelle, Zeilenklick, Aktionsspalte)
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['/customers']
endpoints: ['listCustomersRemote']
tables: ['customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-178 — Kundenliste (Tabelle, Zeilenklick, Aktionsspalte)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kundenliste (Tabelle, Zeilenklick, Aktionsspalte)

## Erwartetes Verhalten

Spalten Kundennr./Name-Firma/Ort/Telefon/E-Mail/Aktion; Label-Priorität `company > "first last" > ebayHandle > customerNumber`; ganze Zeile klickbar → Detail; Aktionszelle mit `stopPropagation` (Bearbeiten, Löschen, Reaktivieren nur archiviert); Badge "Archiviert"

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
| Endpoints | `listCustomersRemote` |
| Tabellen | `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-178 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
