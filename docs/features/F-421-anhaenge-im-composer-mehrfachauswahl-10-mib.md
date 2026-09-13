---
id: F-421
title: Anhänge im Composer (Mehrfachauswahl, 10-MiB-Cap/Datei mit Toast, Entfernen, Größenanzeige)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/customers/[id]', '/mailings']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-421 — Anhänge im Composer (Mehrfachauswahl, 10-MiB-Cap/Datei mit Toast, Entfernen, Größenanzeige)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Anhänge im Composer (Mehrfachauswahl, 10-MiB-Cap/Datei mit Toast, Entfernen, Größenanzeige)

## Erwartetes Verhalten

Base64 im Speicher; Serverseitig Filename 1..255, MIME ≤100

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
| Routen | `/customers/[id]`, `/mailings` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-421 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
