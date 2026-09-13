---
id: F-334
title: Positionen-Tabelle
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/[id]']
endpoints: ['getWorkOrderRemote']
tables: ['work_order_items']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-334 — Positionen-Tabelle

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Positionen-Tabelle

## Erwartetes Verhalten

ab `lg` Tabelle: Pos, Beschreibung (+ "Arbeitszeit"/"Material · dd.MM.yyyy"), Mitarbeiter (Name aus Roster oder "-"), "Std. / Menge" (labor: `hours ?? quantity` + " Std."; material: `quantity unit`), Einzelpreis, Summe (`quantity × unitPriceNet`, `formatEuro`), Aktionen (nur wenn nicht gesperrt); `tfoot` "Summe (netto)"; unter `lg` gestapelte Liste "{Menge} x {Preis} = {Summe}"; Leerzustand "Noch keine Positionen erfasst."; Mengenformat `de-DE` 0–3 Nachkommastellen

## Nutzersicht

_Wird mit T-020 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-020 ergänzt._

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
| Routen | `/orders/[id]` |
| Endpoints | `getWorkOrderRemote` |
| Tabellen | `work_order_items` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-334 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
