---
id: F-506
title: Stundenliste (Manager) mit Scope-Tabs, Datumsfilter, Mitarbeiterfilter, Auftrags-Deep-Link
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours', '/hours?workOrderId=']
endpoints: ['canReadAllHoursRemote', 'listTimeEntriesRemote']
tables: ['time_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-506 — Stundenliste (Manager) mit Scope-Tabs, Datumsfilter, Mitarbeiterfilter, Auftrags-Deep-Link

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Stundenliste (Manager) mit Scope-Tabs, Datumsfilter, Mitarbeiterfilter, Auftrags-Deep-Link

## Erwartetes Verhalten

Tabs "Eigene/Alle" (Default Alle); Von/Bis inklusiv; Mitarbeiter-Picker nur bei "Alle"; Auftrags-Chip entfernbar; Sortierung Datum DESC, dann Anlage DESC; Spalten Datum, Mitarbeiter, Stunden (2 NK, de-DE), Auftrag (Link `/orders/{id}`), Beleg / Kunde (Beleg-Nr. > Kundenname > Aufgabe), Notiz, Aktion; Fußzeile "Summe" über Filter; responsive Kartenliste < lg; Filteränderung → Seite 1

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
| Routen | `/hours`, `/hours?workOrderId=` |
| Endpoints | `canReadAllHoursRemote`, `listTimeEntriesRemote` |
| Tabellen | `time_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-506 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
