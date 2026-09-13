---
id: F-511
title: Stundeneintrag-Detail
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

# F-511 — Stundeneintrag-Detail

> **Status: gestrichen.** Dieses Feature des Vorgängersystems wird **nicht**
> übernommen. Die Entscheidung und ihre Begründung stehen als **M-10** in
> [09-modellaenderungen.md](../rewrite/09-modellaenderungen.md).

## Was der Vorgänger tat

Titel `dd.mm.yyyy · h,hh h`; Karten Stammdaten, Verknüpfung (Auftrag-Link, Beleg-Link → `/invoices/{documentId}`, Kunde-Link, Aufgabe), Notiz; Bearbeiten/Löschen nur wenn nicht order-derived; write_own nur eigene (403)

## Warum es entfällt

Siehe [M-10 in 09-modellaenderungen.md](../rewrite/09-modellaenderungen.md)
und die Übersicht „Was gestrichen wird" im selben Dokument.

## Quellen

- Inventar: [F-511 in 01-inventar.md](../rewrite/01-inventar.md)
- Abdeckung: [06-abdeckung.md](../rewrite/06-abdeckung.md)
- Übersicht: [docs/index.md](../index.md)
