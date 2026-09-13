---
id: F-309
title: Erinnerungen versenden
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-016
permission: offen
routes: ['/settings/tire-reminders']
endpoints: ['sendTireRemindersRemote']
tables: ['tire_reminder_log', 'sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-309 — Erinnerungen versenden

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-016** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Erinnerungen versenden

## Erwartetes Verhalten

Bestätigung „Erinnerungen jetzt versenden?"; Vorlage `tire_reminder`; Protokollzeile erst nach erfolgreichem Versand; zweiter Lauf im selben Jahr ist wirkungslos

## Nutzersicht

_Wird mit T-016 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-016 ergänzt._

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
| Routen | `/settings/tire-reminders` |
| Endpoints | `sendTireRemindersRemote` |
| Tabellen | `tire_reminder_log`, `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-016 ergänzt._

## Quellen

- Inventar: [F-309 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-016 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
