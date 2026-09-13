---
id: F-516
title: Karte 'Erfasste Stunden' auf Beleg-Detail
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/invoices/[id]', '/offers/[id]']
endpoints: ['listTimeEntriesRemote({ documentId })']
tables: ['time_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-516 — Karte "Erfasste Stunden" auf Beleg-Detail

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Karte "Erfasste Stunden" auf Beleg-Detail

## Erwartetes Verhalten

Nur wenn Einträge vorhanden; Spalten Datum, Mitarbeiter, Aufgabe, Stunden, Aktion (Badge "Auftrag" oder "Löschen" nach Berechtigungslogik)

## Nutzersicht

_Wird mit T-018 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-018 ergänzt._

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
| Routen | `/invoices/[id]`, `/offers/[id]` |
| Endpoints | `listTimeEntriesRemote({ documentId })` |
| Tabellen | `time_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-516 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
