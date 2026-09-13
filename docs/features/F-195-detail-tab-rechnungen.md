---
id: F-195
title: Detail: Tab Rechnungen
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['?tab=rechnungen']
endpoints: ['getCustomerRelatedRemote']
tables: ['documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-195 — Detail: Tab Rechnungen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail: Tab Rechnungen

## Erwartetes Verhalten

Nur `type='invoice'`, `issueDate DESC`, unbegrenzt; Status-Badges; Klick → `/invoices/{id}`

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
| Routen | `?tab=rechnungen` |
| Endpoints | `getCustomerRelatedRemote` |
| Tabellen | `documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-195 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
