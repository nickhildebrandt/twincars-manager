---
id: F-612
title: Ergebnis-Modal
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: ['/settings/import']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-612 — Ergebnis-Modal

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Ergebnis-Modal

## Erwartetes Verhalten

Tabelle Kategorie/Importiert (Kunden, Fahrzeuge, Lieferanten, Artikel / Leistungen, Rechnungen, Rechnungspositionen, Teilzahlungen, Angebote / KV / AB, Angebotspositionen, Zahlungserinnerungen, Reifeneinlagerungen, Mitarbeiter, Termine, PDFs gerendert); Alert „N Bestandskorrektur-Rechnungen" mit ersten 20 Nummern; Zeile „Übersprungen (Gründe siehe Detailliste): …" wenn Summe > 0; Collapse „N nicht importierte Datensätze - Details anzeigen" mit Tabelle Tabelle/Schlüssel/Grund (max. 1000, Hinweis bei Kürzung); Warnbox (Belege abgeschlossen, PDFs im Cache, kein Fahrzeugbezug); Backdrop-Klick schließt

## Nutzersicht

_Wird mit T-033 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-033 ergänzt._

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
| Routen | `/settings/import` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-612 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
