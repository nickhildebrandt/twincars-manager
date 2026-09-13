---
id: F-434
title: Zahlungserinnerungs-Einstellungen: Auto-Toggle, Kleinunternehmer-Toggle, Erste Erinnerung nach N Tagen (0–365), Folge alle N Tage (1–365)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-025
permission: offen
routes: ['/settings/reminders']
endpoints: ['updateReminderSettingsRemote']
tables: ['company_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-434 — Zahlungserinnerungs-Einstellungen: Auto-Toggle, Kleinunternehmer-Toggle, Erste Erinnerung nach N Tagen (0–365), Folge alle N Tage (1–365)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-025** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Zahlungserinnerungs-Einstellungen: Auto-Toggle, Kleinunternehmer-Toggle, Erste Erinnerung nach N Tagen (0–365), Folge alle N Tage (1–365)

## Erwartetes Verhalten

Valibot mit deutschen Meldungen; Default 3/14; Einmal-Initialisierung aus `getAllSettingsRemote`

## Nutzersicht

_Wird mit T-025 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-025 ergänzt._

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
| Routen | `/settings/reminders` |
| Endpoints | `updateReminderSettingsRemote` |
| Tabellen | `company_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-025 ergänzt._

## Quellen

- Inventar: [F-434 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-025 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
