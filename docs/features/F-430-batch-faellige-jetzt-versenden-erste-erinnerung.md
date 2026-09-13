---
id: F-430
title: Batch „Fällige jetzt versenden' (erste Erinnerung `dueDate + reminderDays1`, Folge `letzte + reminderRecurEveryDays`)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-025
permission: offen
routes: ['/reminders']
endpoints: ['autoSendDuePaymentRemindersRemote', 'listDuePaymentReminderCandidates', 'autoSendDuePaymentReminders']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-430 — Batch „Fällige jetzt versenden" (erste Erinnerung `dueDate + reminderDays1`, Folge `letzte + reminderRecurEveryDays`)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-025** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Batch „Fällige jetzt versenden" (erste Erinnerung `dueDate + reminderDays1`, Folge `letzte + reminderRecurEveryDays`)

## Erwartetes Verhalten

Sequentiell, Fehler gezählt, Toast mit Zahlen; kein Scheduler (ADR-009); Toggle `reminderAutoEnabled` ohne Wirkung

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
| Routen | `/reminders` |
| Endpoints | `autoSendDuePaymentRemindersRemote`, `listDuePaymentReminderCandidates`, `autoSendDuePaymentReminders` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-025 ergänzt._

## Quellen

- Inventar: [F-430 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-025 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
