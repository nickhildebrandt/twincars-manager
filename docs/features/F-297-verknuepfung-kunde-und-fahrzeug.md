---
id: F-297
title: Verknüpfung Kunde und Fahrzeug
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-014
permission: offen
routes: ['/tire-storage/*']
endpoints: ['createTireStorageRemote']
tables: ['tire_storage']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-297 — Verknüpfung Kunde und Fahrzeug

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-014** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Verknüpfung Kunde und Fahrzeug

## Erwartetes Verhalten

Kunde über Picker, Fahrzeug optional; Kunde ist gegen Löschen geschützt

## Nutzersicht

_Wird mit T-014 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-014 ergänzt._

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
| Routen | `/tire-storage/*` |
| Endpoints | `createTireStorageRemote` |
| Tabellen | `tire_storage` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-014 ergänzt._

## Quellen

- Inventar: [F-297 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-014 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
