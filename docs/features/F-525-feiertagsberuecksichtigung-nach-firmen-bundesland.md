---
id: F-525
title: Feiertagsberücksichtigung nach Firmen-Bundesland
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-019
permission: offen
routes: []
endpoints: ['getCompanyHolidayState', 'isPublicHoliday']
tables: ['company_settings.state']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-525 — Feiertagsberücksichtigung nach Firmen-Bundesland

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Feiertagsberücksichtigung nach Firmen-Bundesland

## Erwartetes Verhalten

Freitext-Bundesland → ISO-Code, Fallback `DE` (9 Bundesfeiertage); nur landesweite gesetzliche Feiertage

## Nutzersicht

_Wird mit T-019 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-019 ergänzt._

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
| Endpoints | `getCompanyHolidayState`, `isPublicHoliday` |
| Tabellen | `company_settings.state` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-525 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
