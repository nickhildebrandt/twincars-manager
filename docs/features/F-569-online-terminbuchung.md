---
id: F-569
title: Online-Terminbuchung
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/appointments']
endpoints: ['handleBookAppointment']
tables: ['items', 'customers', 'number_ranges', 'calendar_entries', 'sent_messages', 'mail_templates', 'smtp_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-569 — Online-Terminbuchung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Online-Terminbuchung

## Erwartetes Verhalten

Nur `onlineBookable`-Service (Pflicht), `durationMinutes` Pflicht, Start in Zukunft, Slot muss exakt im freien Raster liegen (sonst 409), Kunde per E-Mail wiederverwendet oder neu (Nummernkreis, Name-Split), Termin `scheduled` mit Servicetitel und `confirmation:<uuid>` in `notes`, Bestätigungsmail best-effort; Antwort mit ID, Zeitraum, Token

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
| Routen | `/api/public/appointments` |
| Endpoints | `handleBookAppointment` |
| Tabellen | `items`, `customers`, `number_ranges`, `calendar_entries`, `sent_messages`, `mail_templates`, `smtp_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-569 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
