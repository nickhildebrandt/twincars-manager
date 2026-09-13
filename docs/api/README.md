---
title: API
kategorie: api
status: umgesetzt
updated: 2026-09-13
---

# API

Jeder Endpoint der Anwendung mit Methode, Pfad, Ein- und Ausgabeschema,
nötiger Berechtigung, Fehlercodes und Beispielaufruf.

Zurück zur [Übersicht](../index.md).

## Aufbau

- **Interne API** (`/api/**`): von der Oberfläche benutzt, sitzungsgebunden.
  Jeder Endpoint beginnt mit einer Berechtigungsprüfung.
- **Öffentliche API** (`/api/public/**`): von der Website benutzt,
  Bearer-Token, eigenes Anfragelimit.
- **Fremdsysteme**: der eBay-Pflichtendpunkt und die Anmeldung.

## Antwortformen

| Art | Form |
| --- | --- |
| Liste | `{ items, total, page, size, pageCount }` — serverseitig, fest 25 je Seite |
| Einzelressource | das Objekt selbst |
| Mutation | das geänderte Objekt oder `{ ok: true }` |

## Fehler

Jeder Fehler trägt eine deutsche Nachricht und einen Code. 422 führt zusätzlich
`data.fields` mit Feldfehlern, die das Formular direkt anzeigt. 5xx geben nie
Interna preis. Einzelheiten: [Fehlerbehandlung](../architecture/README.md).

## Vollständigkeit

`pnpm docs:check` bricht ab, sobald ein Endpoint unter `server/api/` keinen
Eintrag hier hat. Die Seiten entstehen mit `pnpm docs:api` aus den
Endpoint-Dateien und ihren Valibot-Schemata.

## Die Seiten

| Endpoint | Berechtigung | Zweck |
| --- | --- | --- |
| [GET /api/health](health-get.md) | offen | Zustandsprüfung für den Container |
| [GET /api/me](me-get.md) | offen | wer angemeldet ist, welche Module sichtbar sind |
| [/api/auth/…](auth-all-.md) | offen | Anmeldung, Abmeldung, Sitzung, Passwortwechsel |
| [GET /api/pickers/customers](pickers-customers-get.md) | `customers` | Auswahl: Kunden |
| [GET /api/pickers/vehicles](pickers-vehicles-get.md) | `vehicles` | Auswahl: Fahrzeuge |
| [GET /api/pickers/items](pickers-items-get.md) | `items` oder `orders` | Auswahl: Artikel und Leistungen |
| [GET /api/pickers/tires](pickers-tires-get.md) | `tires` | Auswahl: Reifen |
| [GET /api/pickers/employees](pickers-employees-get.md) | `employees` oder `orders` | Auswahl: Mitarbeiter |
| [GET /api/pickers/suppliers](pickers-suppliers-get.md) | `suppliers` | Auswahl: Lieferanten |
| [GET /api/pickers/documents](pickers-documents-get.md) | `invoices` | Auswahl: Belege |

Die fachlichen Endpoints entstehen mit ihren Paketen.
