---
id: F-417
title: Vorlagen-Versand mit PDF-Anhang für Rechnung/Angebot/KV/AB
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/invoices/[id]', '/offers/[id]']
endpoints: ['sendDocumentEmail']
tables: ['mail_templates', 'document_pdfs', 'sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-417 — Vorlagen-Versand mit PDF-Anhang für Rechnung/Angebot/KV/AB

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Vorlagen-Versand mit PDF-Anhang für Rechnung/Angebot/KV/AB

## Erwartetes Verhalten

Anhang aus Cache/Render; Render-Fehler → still ohne Anhang; Erfolg setzt Belegstatus `sent` (im Aufrufer)

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
| Routen | `/invoices/[id]`, `/offers/[id]` |
| Endpoints | `sendDocumentEmail` |
| Tabellen | `mail_templates`, `document_pdfs`, `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-417 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
