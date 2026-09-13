---
id: F-428
title: OP-Liste offener Rechnungen mit Verzugstagen, Offen-Betrag (abzgl. Teilzahlungen), Erinnerungszähler, letzte Erinnerung; StatCards Offene Beträge / Überfällige Rechnungen / Überfälliger Betrag
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-025
permission: offen
routes: ['/reminders']
endpoints: ['listOpenInvoicesRemote']
tables: ['documents', 'document_payments', 'reminders', 'customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-428 — OP-Liste offener Rechnungen mit Verzugstagen, Offen-Betrag (abzgl. Teilzahlungen), Erinnerungszähler, letzte Erinnerung; StatCards Offene Beträge / Überfällige Rechnungen / Überfälliger Betrag

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-025** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

OP-Liste offener Rechnungen mit Verzugstagen, Offen-Betrag (abzgl. Teilzahlungen), Erinnerungszähler, letzte Erinnerung; StatCards Offene Beträge / Überfällige Rechnungen / Überfälliger Betrag

## Erwartetes Verhalten

Status-Ausschluss paid/cancelled/storno/draft/converted; Sortierung Fälligkeit ASC; Desktop-Tabelle + Mobile-Cards; Zeile → `/invoices/[id]`; unpaginiert

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
| Endpoints | `listOpenInvoicesRemote` |
| Tabellen | `documents`, `document_payments`, `reminders`, `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-025 ergänzt._

## Quellen

- Inventar: [F-428 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-025 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
