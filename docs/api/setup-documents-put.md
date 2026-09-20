---
title: PUT /api/setup/documents
kategorie: api
method: PUT
path: /api/setup/documents
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-20
---

# /api/setup/documents

Schritt 4: Belegvorgaben, Nummernkreise und Stundensatz.

## Körper

`documentDefaultsSchema` — Anrede, Zahlungsziel, Stundensatz, Endtext und eine
Liste von Nummernkreisen.

Drei Dinge wandern dabei an drei Orte, in **einer** Transaktion: Anrede,
Zahlungsziel und Endtext in die Einstellungszeile, die Kreise in
`number_ranges`, der Stundensatz als Preisversion an den Arbeitszeit-Artikel
(M-22). Ein Assistent, der mit halb gesetzten Vorgaben endet, wäre schlimmer
als einer, der abbricht.

## Nummernvorlagen

| Platzhalter | Bedeutung |
| --- | --- |
| `{YYYY}` | vierstelliges Jahr |
| `{YY}` | zweistelliges Jahr |
| `{MM}` | Monat |
| `{N}` … `{NNNNN}` | der Zähler, mit so vielen Stellen wie Buchstaben |

Der **Zähler ist Pflicht**: ohne ihn bekäme jeder Beleg dieselbe Nummer.

Der **Startwert** ist frei wählbar, damit der Betrieb oberhalb seiner
Altnummern anfangen kann — die laufen bis `20090446`.

## Fehler

| Status | Bedingung |
| --- | --- |
| 409 | Stundensatz gesetzt, aber kein Arbeitszeit-Artikel hinterlegt |

## Berechtigung

`offen`, siehe [`GET /api/setup/state`](setup-state-get.md).

## Quelle

`server/api/setup/documents.ts`, Dienste in
`server/services/setup-service.ts` und `server/services/settings-service.ts`.
Geprüft in `test/integration/setup.test.ts` und
`test/unit/settings-schemas.test.ts`.

Zurück zur [API-Übersicht](README.md)
