---
id: F-177
title: Standard-MwSt., Zahlungsziel, Währung
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: []
endpoints: ['updateCompanyRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-177 — Standard-MwSt., Zahlungsziel, Währung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Standard-MwSt., Zahlungsziel, Währung

## Erwartetes Verhalten

Defaults 19.00 / 14 Tage / EUR; **nirgends editierbar** (Schema akzeptiert `defaultVatRate`/`defaultPaymentTermDays`, UI sendet sie nicht; Währung fest).

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
| Routen | — |
| Endpoints | `updateCompanyRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-177 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
