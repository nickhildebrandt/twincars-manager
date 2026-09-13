---
id: F-340
title: Server-Normalisierung der Position
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: []
endpoints: []
tables: ['work_order_items']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-340 — Server-Normalisierung der Position

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Server-Normalisierung der Position

## Erwartetes Verhalten

Fortlaufende `position` je Auftrag; labor: `quantity = hours`, `unit='Std.'` (Default), `hours` Pflichtwert; material: `hours=null` (auch wenn gesendet), `quantity` default 1; Preis-Snapshot `unit_price_net` je Position editierbar

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
| Routen | — |
| Endpoints | — |
| Tabellen | `work_order_items` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-340 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
