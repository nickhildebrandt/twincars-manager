---
id: F-181
title: Kind-Filter-Tabs Alle/Privat/Firma/eBay
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['/customers']
endpoints: ['listCustomersRemote', 'kind']
tables: ['customers.kind', 'customers.company']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-181 — Kind-Filter-Tabs Alle/Privat/Firma/eBay

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kind-Filter-Tabs Alle/Privat/Firma/eBay

## Erwartetes Verhalten

`all/private/business` → `kind='regular'`; `business` = `company IS NOT NULL`, `private` = `company IS NULL`; `ebay` = `kind='ebay'` mit Spalten eBay-Name + eingetragen am; Tabwechsel resettet Seite; einfache Filter-Tabs (kein TabGroup)

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
| Endpoints | `listCustomersRemote`, `kind` |
| Tabellen | `customers.kind`, `customers.company` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-181 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
