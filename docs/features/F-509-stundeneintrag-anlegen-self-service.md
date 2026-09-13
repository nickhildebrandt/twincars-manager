---
id: F-509
title: Stundeneintrag anlegen (Self-Service)
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

# F-509 — Stundeneintrag anlegen (Self-Service)

> **Status: gestrichen.** Dieses Feature des Vorgängersystems wird **nicht**
> übernommen. Die Entscheidung und ihre Begründung stehen als **M-10** in
> [09-modellaenderungen.md](../rewrite/09-modellaenderungen.md).

## Was der Vorgänger tat

Mitarbeiter fest (Name read-only) über `privateEmail = users.email` (nicht archiviert); fremde `employeeId` → 403; kein Profil → 403 "Kein Mitarbeiterprofil verknüpft."

## Warum es entfällt

Siehe [M-10 in 09-modellaenderungen.md](../rewrite/09-modellaenderungen.md)
und die Übersicht „Was gestrichen wird" im selben Dokument.

## Quellen

- Inventar: [F-509 in 01-inventar.md](../rewrite/01-inventar.md)
- Abdeckung: [06-abdeckung.md](../rewrite/06-abdeckung.md)
- Übersicht: [docs/index.md](../index.md)
