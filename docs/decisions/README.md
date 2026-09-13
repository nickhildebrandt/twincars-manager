---
title: Entscheidungen
kategorie: decisions
status: umgesetzt
updated: 2026-09-13
---

# Entscheidungen

Je eine kurze Seite: Kontext, Optionen, Entscheidung, Konsequenzen.

Zurück zur [Übersicht](../index.md).

## Entscheidungen des Umbaus

Während der Umbau läuft, werden die Entscheidungen im Plan geführt und von dort
nach und nach hierher übernommen:
[08-entscheidungen.md](../rewrite/08-entscheidungen.md).

Technisch entschieden: Authentifizierung bleibt bei better-auth · Migrationen
mit Squash-Baseline · echtes PostgreSQL im Test statt Simulation · pdf-lib
bleibt · Seitengröße bleibt 25 · ESLint statt Prettier · TypeScript 6 vorerst.

Fachlich entschieden (E-10 bis E-20):

| Nr.  | Entscheidung                                                        | eigene Seite                                                           |
| ---- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| E-10 | Geld ist eine ganze Zahl in Cent                                    | [Geldbeträge](../architecture/money.md)                                |
| E-11 | Löschen mit Kaskade und Vorschau, Sperre bei ausgestellter Rechnung | [Löschen und Archivieren](../architecture/loeschen-und-archivieren.md) |
| E-12 | Erinnerungen laufen werktags um 7:30 Uhr automatisch                | —                                                                      |
| E-13 | Verkaufsinserate mit allen Feldern                                  | —                                                                      |
| E-14 | Zahlungen werden erfasst, „bezahlt" wird berechnet                  | —                                                                      |
| E-15 | Umsatz sind ausgestellte Rechnungen                                 | —                                                                      |
| E-16 | Kundenart ist ein Feld: privat, firma, ebay                         | —                                                                      |
| E-17 | Dateien bleiben in der Datenbank                                    | —                                                                      |
| E-18 | eBay wird unverändert portiert                                      | —                                                                      |
| E-19 | Der Import gleicht ab statt zu leeren                               | —                                                                      |
| E-20 | Leerer Start, Bestand kommt aus dem Import                          | —                                                                      |

## Entscheidungen des Vorgängersystems

Die folgenden Aufzeichnungen stammen aus der SvelteKit-Fassung. Die fachlichen
darunter gelten weiter, die technischen werden durch den Umbau abgelöst.

| Nr.                                                      | Thema                                   | gilt weiter                            |
| -------------------------------------------------------- | --------------------------------------- | -------------------------------------- |
| [ADR-001](adr-001-remote-functions-only.md)              | Remote Functions als einziger Transport | nein — abgelöst durch Nitro-Endpoints  |
| [ADR-002](adr-002-per-module-permissions.md)             | eine Berechtigung je Modul              | **ja**                                 |
| [ADR-003](adr-003-pagination-fixed-25.md)                | Seitengröße fest 25                     | **ja**                                 |
| [ADR-004](adr-004-import-wipe-first-read-before-wipe.md) | Legacy-Import: erst lesen, dann leeren  | nein — abgelöst durch E-19             |
| [ADR-005](adr-005-encryption-scope.md)                   | was verschlüsselt wird                  | **ja**                                 |
| [ADR-006](adr-006-pdfs-in-postgres.md)                   | PDFs in der Datenbank                   | **ja**                                 |
| [ADR-007](adr-007-price-snapshots-and-versions.md)       | Preis-Schnappschüsse und Versionen      | **ja**                                 |
| [ADR-008](adr-008-single-busy-store.md)                  | eine globale Ladeanzeige                | **ja**                                 |
| [ADR-009](adr-009-no-in-process-scheduler.md)            | kein Scheduler im Prozess               | nein — abgelöst durch E-12             |
| [ADR-010](adr-010-api-tokens-in-env.md)                  | API-Token aus der Umgebung              | **ja**                                 |
| [ADR-011](adr-011-unified-calendar-entries.md)           | ein Kalendermodell                      | **ja**                                 |
| [ADR-012](adr-012-pnpm-and-exact-pins.md)                | pnpm und feste Versionen                | **ja**                                 |
| [ADR-013](adr-013-username-only-auth.md)                 | Anmeldung nur mit Benutzername          | **ja**                                 |
| [ADR-014](adr-014-ebay-two-way-sync-deferred.md)         | eBay-Synchronisierung zurückgestellt    | **ja**                                 |
| [ADR-015](adr-015-storno-instead-of-delete.md)           | Stornieren statt Löschen                | **ja** — Umfang siehe E-11             |
| [ADR-016](adr-016-shop-refocus.md)                       | Bestandsfelder entfernt                 | **ja**                                 |
| [ADR-017](adr-017-broadcast-unsubscribe-mailto.md)       | Abbestellen per Antwortmail             | **ja**                                 |
| [ADR-018](adr-018-otel-noop-shim.md)                     | Telemetrie-Platzhalter                  | nein — Bau-Eigenheit der alten Fassung |
