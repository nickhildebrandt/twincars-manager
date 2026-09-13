---
title: Architektur
kategorie: architecture
status: umgesetzt
updated: 2026-09-13
---

# Architektur

Systemüberblick der Nuxt-Fassung.

Zurück zur [Übersicht](../index.md).

> **Hinweis:** Die übrigen Seiten in diesem Ordner beschreiben noch die alte
> SvelteKit-Fassung. Sie werden im Zuge des Umbaus ersetzt.

## In einem Absatz

Eine einzelne, serverseitig gerenderte Node-Anwendung mit PostgreSQL. Nuxt
liefert Oberfläche und Server; Nitro stellt die Endpoints bereit; Drizzle
spricht mit der Datenbank; Valibot prüft jede Eingabe. Eine Instanz, ein
Betrieb, keine Hintergrunddienste.

## Schichten

| Schicht       | Ort                | Aufgabe                                                  |
| ------------- | ------------------ | -------------------------------------------------------- |
| Oberfläche    | `app/`             | Seiten, Komponenten, Composables                         |
| HTTP          | `server/api/`      | Berechtigung prüfen, Eingabe validieren, Dienst aufrufen |
| Fachlogik     | `server/services/` | Regeln und Datenbankzugriff                              |
| Infrastruktur | `server/utils/`    | Verbindung, Krypto, Mail, PDF                            |
| Geteilt       | `shared/`          | Valibot-Schemata, Berechtigungen, abgeleitete Typen      |

Dienste bekommen einfache Argumente, nie das Anfrageobjekt — dadurch sind sie
ohne HTTP prüfbar.

## Verbindliche Vorgaben

Die vollständigen technischen Vorgaben stehen bis zum Abschluss des Umbaus im
Plan: [Zielarchitektur](../rewrite/03-architektur.md).

Kurz: Nuxt-Bordmittel vor Fremdpaketen · Valibot an jeder Grenze · Berechtigung
als erste Anweisung jedes Endpoints · serverseitige Pagination mit fester Größe
· Toast bei jeder Änderung · Transaktion, sobald mehr als eine Anweisung
schreibt · kein eigenes CSS · ESLint formatiert.

## Querschnittsregeln der neuen Fassung

| Regel                                             | Seite                                                  |
| ------------------------------------------------- | ------------------------------------------------------ |
| Geld ist eine ganze Zahl in Cent                  | [Geldbeträge](money.md)                                |
| Löschen, Archivieren und was mitgeht              | [Löschen und Archivieren](loeschen-und-archivieren.md) |
| Wächter, Listen, Nummern, Krypto, Zeitplan        | [Serverschichten](server-schichten.md)                 |
| Werte der Diskriminatoren und ihre Beschriftungen | [Wertelisten](wertelisten.md)                          |
