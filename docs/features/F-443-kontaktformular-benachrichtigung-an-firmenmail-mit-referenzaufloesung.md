---
id: F-443
title: Kontaktformular-Benachrichtigung an Firmenmail mit Referenzauflösung (Fahrzeug/Reifen/Artikel), Reply-To = Anfragender, Retry aus Anfragen-Liste
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-031
permission: offen
routes: ['POST /api/public/contact', '/settings/inquiries']
endpoints: ['sendContactNotification', 'recordInquiryNotificationResult', 'retryInquiryNotificationRemote']
tables: ['customer_inquiries', 'sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-443 — Kontaktformular-Benachrichtigung an Firmenmail mit Referenzauflösung (Fahrzeug/Reifen/Artikel), Reply-To = Anfragender, Retry aus Anfragen-Liste

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kontaktformular-Benachrichtigung an Firmenmail mit Referenzauflösung (Fahrzeug/Reifen/Artikel), Reply-To = Anfragender, Retry aus Anfragen-Liste

## Erwartetes Verhalten

Audit-Typ `mailing`; Statusspalten am Inquiry

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
| Routen | `POST /api/public/contact`, `/settings/inquiries` |
| Endpoints | `sendContactNotification`, `recordInquiryNotificationResult`, `retryInquiryNotificationRemote` |
| Tabellen | `customer_inquiries`, `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-443 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
