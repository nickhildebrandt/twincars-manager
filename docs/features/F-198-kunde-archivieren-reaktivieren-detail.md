---
id: F-198
title: Kunde archivieren/reaktivieren (Detail)
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['/customers/[id]']
endpoints: ['setCustomerArchivedRemote']
tables: ['customers.archived']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-198 — Kunde archivieren/reaktivieren (Detail)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kunde archivieren/reaktivieren (Detail)

## Erwartetes Verhalten

ConfirmDialog mit kuratierten Texten; Toasts; Warnbanner im archivierten Zustand; Seite flippt ohne Remount

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
| Routen | `/customers/[id]` |
| Endpoints | `setCustomerArchivedRemote` |
| Tabellen | `customers.archived` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-198 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
