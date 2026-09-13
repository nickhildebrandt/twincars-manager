---
id: F-551
title: Terminbuchung (extern)
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-031
permission: offen
routes: ['POST /api/public/appointments']
endpoints: ['findFreeSlots', 'getItem', 'nextCustomerNumber', 'sendAppointmentConfirmation']
tables: ['items', 'customers', 'calendar_entries', 'number_ranges', 'sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-551 — Terminbuchung (extern)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Terminbuchung (extern)

## Erwartetes Verhalten

Nur `onlineBookable` Services (Pflicht), `durationMinutes` Pflicht, Start > jetzt, Start muss exakt ein freier Raster-Slot sein (sonst 409), Kunde per E-Mail exakt gematcht oder neu (`regular`, Name-Split am ersten Leerzeichen), Termin `scheduled` mit Titel = Service-Beschreibung, `notes` = Kundennotiz + `confirmation:<uuid>`, Antwort mit Token; keine Transaktion; keine Fahrzeug-/Mitarbeiterzuordnung.

## Nutzersicht

_Wird mit T-031 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-031 ergänzt._

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
| Routen | `POST /api/public/appointments` |
| Endpoints | `findFreeSlots`, `getItem`, `nextCustomerNumber`, `sendAppointmentConfirmation` |
| Tabellen | `items`, `customers`, `calendar_entries`, `number_ranges`, `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-551 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
