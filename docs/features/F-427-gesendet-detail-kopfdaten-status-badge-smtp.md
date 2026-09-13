---
id: F-427
title: Gesendet-Detail: Kopfdaten, Status-Badge, SMTP-Fehlertext, Body-Text, PDF-Viewer (Beleg/Reminder)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/sent/[id]']
endpoints: ['getSentMessageRemote', 'getDocumentPdfBytesRemote', 'getReminderPdfBytesRemote']
tables: ['sent_messages', 'document_pdfs', 'reminder_pdfs']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-427 — Gesendet-Detail: Kopfdaten, Status-Badge, SMTP-Fehlertext, Body-Text, PDF-Viewer (Beleg/Reminder)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Gesendet-Detail: Kopfdaten, Status-Badge, SMTP-Fehlertext, Body-Text, PDF-Viewer (Beleg/Reminder)

## Erwartetes Verhalten

`pdfKind` aus `documentType`; kein Resend, keine Anhangsliste

## Nutzersicht

_Wird mit T-026 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-026 ergänzt._

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
| Routen | `/sent/[id]` |
| Endpoints | `getSentMessageRemote`, `getDocumentPdfBytesRemote`, `getReminderPdfBytesRemote` |
| Tabellen | `sent_messages`, `document_pdfs`, `reminder_pdfs` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-427 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
