---
id: F-201
title: Lösch-Guard mit Zählungen
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: []
endpoints: ['deleteCustomer']
tables: ['vehicles', 'documents', 'tire_storage']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-201 — Lösch-Guard mit Zählungen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Lösch-Guard mit Zählungen

## Erwartetes Verhalten

409 "Es sind noch <n Fahrzeug(e)>, <n Beleg(e)>, <n Reifeneinlagerung(en)> mit diesem Kunden verknüpft. Bitte entfernen Sie zuerst die Verknüpfungen oder archivieren Sie den Kunden."; Toast-Präfix "Kunde konnte nicht gelöscht werden"

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
| Routen | — |
| Endpoints | `deleteCustomer` |
| Tabellen | `vehicles`, `documents`, `tire_storage` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-201 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
