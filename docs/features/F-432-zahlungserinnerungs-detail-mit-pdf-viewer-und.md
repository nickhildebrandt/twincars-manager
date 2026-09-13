---
id: F-432
title: Zahlungserinnerungs-Detail mit PDF-Viewer und Forderungsaufstellung
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-025
permission: offen
routes: ['/reminders/[id]']
endpoints: ['getReminderRemote', 'getReminderPdfMetaRemote', 'getReminderPdfBytesRemote']
tables: ['reminders', 'documents', 'customers', 'reminder_pdfs']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-432 — Zahlungserinnerungs-Detail mit PDF-Viewer und Forderungsaufstellung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-025** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Zahlungserinnerungs-Detail mit PDF-Viewer und Forderungsaufstellung

## Erwartetes Verhalten

Nur Cache-PDF (404 bei fehlendem Render); „Offener Betrag" = Rechnungsbrutto; keine Aktionen

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
| Routen | `/reminders/[id]` |
| Endpoints | `getReminderRemote`, `getReminderPdfMetaRemote`, `getReminderPdfBytesRemote` |
| Tabellen | `reminders`, `documents`, `customers`, `reminder_pdfs` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-025 ergänzt._

## Quellen

- Inventar: [F-432 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-025 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
