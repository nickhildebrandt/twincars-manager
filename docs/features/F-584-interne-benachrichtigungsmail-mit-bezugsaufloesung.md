---
id: F-584
title: Interne Benachrichtigungsmail mit Bezugsauflösung
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: []
endpoints: ['sendContactNotification', 'resolveReference', 'buildContactBody']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-584 — Interne Benachrichtigungsmail mit Bezugsauflösung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Interne Benachrichtigungsmail mit Bezugsauflösung

## Erwartetes Verhalten

Betreff `[Anfrage] <subject>`, Absender aus SMTP-Settings, Reply-To Kunde, Blöcke Anfrage von/Betreff/Nachricht/Bezogen auf (Fahrzeug, Reifen, Artikel mit Preis + relativer Detail-URL)/Anfrage-ID/Eingegangen am; Fehlen der Firmen-E-Mail → kuratierter Fehler

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
| Routen | — |
| Endpoints | `sendContactNotification`, `resolveReference`, `buildContactBody` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-584 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
