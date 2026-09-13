---
id: F-583
title: Benachrichtigung erneut senden
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: ['/settings/inquiries']
endpoints: ['retryInquiryNotificationRemote']
tables: ['customer_inquiries', 'sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-583 — Benachrichtigung erneut senden

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Benachrichtigung erneut senden

## Erwartetes Verhalten

Erneuter Versand unabhängig vom bisherigen Status, Ergebnis überschreibt `notification_*`, Toasts „Benachrichtigung erneut gesendet." / „Versand fehlgeschlagen: …"; 404 „Anfrage nicht gefunden."

## Nutzersicht

_Wird mit T-030 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-030 ergänzt._

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
| Routen | `/settings/inquiries` |
| Endpoints | `retryInquiryNotificationRemote` |
| Tabellen | `customer_inquiries`, `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-583 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
