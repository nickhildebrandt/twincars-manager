---
id: F-517
title: Auslastungs-Report
status: gestrichen
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: gestrichen
permission: entfällt
routes: []
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-517 — Auslastungs-Report

> **Status: gestrichen.** Dieses Feature des Vorgängersystems wird **nicht**
> übernommen. Die Entscheidung und ihre Begründung stehen als **M-10** in
> [09-modellaenderungen.md](../rewrite/09-modellaenderungen.md).

## Was der Vorgänger tat

Nur `hours`; Zeitraum (Default Monatserster–heute), optional Mitarbeiter; je Mitarbeiter Stunden, "Davon abrechenbar" (= `document_id` gesetzt, inkl. Angebote), "Tage erfasst" (distinct Datum); Summenzeile; Sortierung Nachname, Vorname; Mitarbeiter ohne Einträge fehlen

## Warum es entfällt

Siehe [M-10 in 09-modellaenderungen.md](../rewrite/09-modellaenderungen.md)
und die Übersicht „Was gestrichen wird" im selben Dokument.

## Quellen

- Inventar: [F-517 in 01-inventar.md](../rewrite/01-inventar.md)
- Abdeckung: [06-abdeckung.md](../rewrite/06-abdeckung.md)
- Übersicht: [docs/index.md](../index.md)
