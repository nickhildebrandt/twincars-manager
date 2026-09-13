---
id: F-419
title: Ad-hoc-E-Mail an einen Kunden (Composer-Modal, Anhänge, HTML-Option)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/customers/[id]']
endpoints: ['sendAdHocCustomerEmailRemote', 'sendAdHocCustomerEmail']
tables: ['customers', 'sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-419 — Ad-hoc-E-Mail an einen Kunden (Composer-Modal, Anhänge, HTML-Option)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Ad-hoc-E-Mail an einen Kunden (Composer-Modal, Anhänge, HTML-Option)

## Erwartetes Verhalten

Guard `customers`; Button ohne E-Mail deaktiviert; Click-Validierung; `documentType='mailing'`; HTML → `text` via `htmlToPlainText`

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
| Routen | `/customers/[id]` |
| Endpoints | `sendAdHocCustomerEmailRemote`, `sendAdHocCustomerEmail` |
| Tabellen | `customers`, `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-419 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
