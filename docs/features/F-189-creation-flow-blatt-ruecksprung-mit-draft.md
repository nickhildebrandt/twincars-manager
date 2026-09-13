---
id: F-189
title: Creation-Flow-Blatt (Rücksprung mit Draft)
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['/customers/new']
endpoints: ['createCustomerRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-189 — Creation-Flow-Blatt (Rücksprung mit Draft)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Creation-Flow-Blatt (Rücksprung mit Draft)

## Erwartetes Verhalten

Info-Alert im Flow-Modus; `finish({id,label})`/`cancel()` → `returnUrl`; Host restauriert Draft und selektiert Kunden (`customerPickerLabel`)

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
| Routen | `/customers/new` |
| Endpoints | `createCustomerRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-189 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
