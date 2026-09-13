---
id: F-487
title: Mitarbeiter-Detail: Karten Person & Anschrift, Beschäftigung, Steuer & SV, Bankverbindung
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: ['/employees/[id]']
endpoints: ['getEmployeeRemote']
tables: ['employees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-487 — Mitarbeiter-Detail: Karten Person & Anschrift, Beschäftigung, Steuer & SV, Bankverbindung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mitarbeiter-Detail: Karten Person & Anschrift, Beschäftigung, Steuer & SV, Bankverbindung

## Erwartetes Verhalten

Anzeige aller Felder außer `title`, `birthplace`, `nationality`, `country`, `mobile`, `terminationDate`, `archived`; Datumsfelder als ISO-Rohtext; Wochenstunden `de-DE`; 404 → Fehlerseite

## Nutzersicht

_Wird mit T-017 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-017 ergänzt._

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
| Routen | `/employees/[id]` |
| Endpoints | `getEmployeeRemote` |
| Tabellen | `employees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-487 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
