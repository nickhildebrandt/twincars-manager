---
id: F-150
title: Setup abschließen
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/setup', '/login']
endpoints: ['completeSetup']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-150 — Setup abschließen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Setup abschließen

## Erwartetes Verhalten

Guards: User vorhanden (400 „Bitte zuerst ein Administrator-Konto anlegen."), Firmenname/Straße/Ort/E-Mail nicht leer (400 „Bitte zuerst die Firmendaten vollständig ausfüllen."); setzt `setup_completed=true`; Toast „Setup abgeschlossen!"; Full-Load `/login`. Button erst aktiv, wenn `adminCreated`.

## Nutzersicht

_Wird mit T-010 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-010 ergänzt._

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
| Routen | `/setup`, `/login` |
| Endpoints | `completeSetup` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-150 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
