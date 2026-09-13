---
id: F-180
title: Serverseitige Volltextsuche
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['/customers']
endpoints: ['listCustomersRemote', 'q']
tables: ['customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-180 — Serverseitige Volltextsuche

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Serverseitige Volltextsuche

## Erwartetes Verhalten

ILIKE `%q%` über customerNumber, lastName, firstName, company, city, zip, street, phone, mobile, email, ebayHandle; Debounce 250 ms; `pageNum = 1`; `q` nur gesetzt, wenn nicht leer

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
| Endpoints | `listCustomersRemote`, `q` |
| Tabellen | `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-180 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
