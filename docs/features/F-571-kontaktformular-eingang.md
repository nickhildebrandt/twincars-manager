---
id: F-571
title: Kontaktformular-Eingang
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/contact']
endpoints: ['handleContactInquiry', 'sendContactNotification', 'recordInquiryNotificationResult']
tables: ['customer_inquiries', 'sent_messages', 'company_settings', 'smtp_settings', 'vehicles', 'tires', 'items']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-571 — Kontaktformular-Eingang

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kontaktformular-Eingang

## Erwartetes Verhalten

Persistieren zuerst, dann interne Mail an Firmen-E-Mail mit Reply-To Kunde und aufgelöstem Bezug (used-car/tire/article), Status `sent`/`failed` auf der Zeile; immer 200

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
| Routen | `/api/public/contact` |
| Endpoints | `handleContactInquiry`, `sendContactNotification`, `recordInquiryNotificationResult` |
| Tabellen | `customer_inquiries`, `sent_messages`, `company_settings`, `smtp_settings`, `vehicles`, `tires`, `items` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-571 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
