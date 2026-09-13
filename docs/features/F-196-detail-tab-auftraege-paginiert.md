---
id: F-196
title: Detail: Tab Aufträge (paginiert)
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['?tab=auftraege']
endpoints: ['listCustomerWorkOrdersRemote']
tables: ['work_orders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-196 — Detail: Tab Aufträge (paginiert)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail: Tab Aufträge (paginiert)

## Erwartetes Verhalten

25/Seite, nur `ordersPage` reaktiv; Badge = `orders.total`; auch mit reinem `orders`-Recht lesbar; Klick → `/orders/{id}`

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
| Routen | `?tab=auftraege` |
| Endpoints | `listCustomerWorkOrdersRemote` |
| Tabellen | `work_orders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-196 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
