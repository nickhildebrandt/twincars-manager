---
title: TwinCarsManager — Dokumentation
kategorie: index
status: umgesetzt
updated: 2026-09-13
---

# TwinCarsManager — Dokumentation

Verwaltungsanwendung für einen kleinen Kfz-Betrieb mit **Werkstatt**,
**Reifenhandel** und **Gebrauchtwagenhandel**. Sie verwaltet Kunden und
Fahrzeuge, Aufträge und Belege, Termine, Personal und Zeiten, Buchhaltung,
Reifenlager und die Inhalte der Website.

Diese Dokumentation ist so angelegt, dass man sich die Anwendung erschließen
kann, **ohne den Code zu lesen**: was sie tut, wie sie aufgebaut ist, warum sie
so aufgebaut ist, und wie man sie bedient, betreibt und erweitert.

> **Jede Seite ist von hier aus in höchstens zwei Klicks erreichbar.**
> Ein Prüfskript (`pnpm docs:check`) sorgt dafür, dass das so bleibt.

---

## Einstiege

| Ich will …                     | Seite                                 |
| ------------------------------ | ------------------------------------- |
| wissen, was die Anwendung kann | [Funktionen](features/README.md)      |
| eine Schnittstelle benutzen    | [API](api/README.md)                  |
| das Datenmodell verstehen      | [Daten](data/README.md)               |
| eine Oberfläche bauen          | [Komponenten](ui/README.md)           |
| den Aufbau verstehen           | [Architektur](architecture/README.md) |
| wissen, warum etwas so ist     | [Entscheidungen](decisions/README.md) |
| entwickeln, testen, ausliefern | [Anleitungen](guides/README.md)       |

## Die Bereiche

### [Funktionen](features/README.md)

Eine Seite je Funktion, mit stabiler Kennung (`F-001` …): Zweck, Nutzersicht,
Ablauf, Berechtigungen, Zustände, betroffene Routen, Endpoints, Tabellen,
Schemata, Tests und bekannte Grenzen. **631 Funktionen** sind erfasst.

### [API](api/README.md)

Jeder Endpoint mit Methode, Pfad, Valibot-Schema für Ein- und Ausgabe,
nötiger Berechtigung, Fehlercodes und Beispielaufruf.

### [Daten](data/README.md)

Tabellen, Spalten, Relationen, Indizes, Migrationsstrategie, Seeds.

### [Komponenten](ui/README.md)

Katalog der eigenen Komponenten: Props, Ereignisse, Slots, Verwendungsbeispiel,
Nuxt-UI-Grundlage, Animations- und Zustandskonventionen.

### [Architektur](architecture/README.md)

Systemüberblick, Ordnerstruktur, Datenfluss, Rendering und Zwischenspeicher,
Authentifizierung, Fehlerbehandlung.

### [Entscheidungen](decisions/README.md)

Je eine kurze Seite: Kontext, Optionen, Entscheidung, Konsequenzen.

### [Anleitungen](guides/README.md)

Entwicklungsumgebung, [Tests](guides/tests.md), Freigabe, Deployment,
Fehlersuche, Betriebsabläufe.

---

## Der Umbau auf Nuxt

Die Anwendung wird derzeit von SvelteKit auf Nuxt umgeschrieben. Der Plan liegt
getrennt von dieser Produktdokumentation:

- [Plan-Übersicht](rewrite/00-uebersicht.md) — Einstieg in den Umbau
- [Inventar](rewrite/01-inventar.md) — das Zielverhalten je Funktion
- [Befunde](rewrite/02-befunde.md) — Fehler des Vorgängersystems
- [Arbeitsplan](rewrite/06-arbeitsplan.md) · [Fortschritt](rewrite/fortschritt.md)

Solange der Umbau läuft, tragen noch nicht umgesetzte Seiten
`status: geplant`.

---

## Bestand (alt)

Die folgenden Bereiche beschreiben die **alte SvelteKit-Fassung**. Sie bleiben
als fachliche Quelle liegen, bis ihr Inhalt in die Struktur oben übernommen
ist, und werden beim Umstieg entfernt.

| Bereich                          | Inhalt                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| [`modules/`](modules/)           | ein Dokument je Modul der alten Anwendung                    |
| [`domain/`](domain/)             | Geschäftsregeln, Belegarten, Begriffe — **weiterhin gültig** |
| [`integrations/`](integrations/) | eBay, öffentliche API, XRechnung, DATEV, SMTP, Legacy-Import |
| [`operations/`](operations/)     | Deployment, Backup, Umgebungsvariablen, Testdatenbank        |
| [`decisions/`](decisions/)       | Architekturentscheidungen des Vorgängers (`adr-001` …)       |
| [`architecture/`](architecture/) | technische Notizen zur alten Fassung                         |
| [`INDEX.md`](INDEX.md)           | der alte Einstieg                                            |
