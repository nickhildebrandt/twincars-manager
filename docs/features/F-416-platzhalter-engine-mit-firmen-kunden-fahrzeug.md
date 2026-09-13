---
id: F-416
title: Platzhalter-Engine `{key}` mit Firmen-, Kunden-, Fahrzeug-, Beleg-Variablen, Anrede-Stil Sie/Du, `extra`-Override, unbekannte Keys bleiben stehen
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: []
endpoints: ['buildVars', 'render']
tables: ['company_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-416 — Platzhalter-Engine `{key}` mit Firmen-, Kunden-, Fahrzeug-, Beleg-Variablen, Anrede-Stil Sie/Du, `extra`-Override, unbekannte Keys bleiben stehen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Platzhalter-Engine `{key}` mit Firmen-, Kunden-, Fahrzeug-, Beleg-Variablen, Anrede-Stil Sie/Du, `extra`-Override, unbekannte Keys bleiben stehen

## Erwartetes Verhalten

Tabelle in §3.1; nur Plain-Text, kein Escaping

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
| Routen | — |
| Endpoints | `buildVars`, `render` |
| Tabellen | `company_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-416 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
