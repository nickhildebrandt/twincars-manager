---
id: F-435
title: Inline-Editor der Vorlage `reminder_1` in den Zahlungserinnerungs-Einstellungen inkl. Reset
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-025
permission: offen
routes: ['/settings/reminders']
endpoints: ['updateMailTemplateRemote', 'resetMailTemplateRemote']
tables: ['mail_templates']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-435 — Inline-Editor der Vorlage `reminder_1` in den Zahlungserinnerungs-Einstellungen inkl. Reset

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-025** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Inline-Editor der Vorlage `reminder_1` in den Zahlungserinnerungs-Einstellungen inkl. Reset

## Erwartetes Verhalten

Gemeinsamer „Speichern"-Button (zwei Commands); Reset re-hydriert Editor

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
| Endpoints | `updateMailTemplateRemote`, `resetMailTemplateRemote` |
| Tabellen | `mail_templates` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-025 ergänzt._

## Quellen

- Inventar: [F-435 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-025 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
