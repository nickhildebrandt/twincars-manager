---
title: GET /api/pickers/customers
kategorie: api
method: GET
path: /api/pickers/customers
permission: customers
status: umgesetzt
features: []
schemas: ['pickerQuerySchema']
updated: 2026-09-13
---

# GET /api/pickers/customers

Die Auswahl für Kunden: serverseitig gesucht, serverseitig geblättert, fest
25 je Seite.

Eine Beziehung wird **nie** über ein `<select>` gewählt und **nie** im Browser
gefiltert. Bei zweitausend Kunden wäre eine Auswahlliste keine Auswahl, und
eine Filterung im Browser hieße, zweitausend Kunden zu übertragen.

## Berechtigung

`customers` — die Absage nennt den Bereich auf Deutsch:
„Sie haben keine Berechtigung für Kunden."

## Eingabe

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `page` | nein | Seitenzahl ab 1; Vorgabe 1 |
| `q` | nein | Suchbegriff; gesucht wird über Firma, Nachname, Vorname, Kundennummer und Ort |

Geprüft wird mit `pickerQuerySchema`
aus `shared/schemas/picker.ts`. Eine Seitenzahl unter 1 antwortet mit **422**
und einem deutschen Satz — beim Vorgänger erzeugte sie einen negativen Versatz
und einen Serverfehler (B-083).

## Ausgabe

```json
{
  "items": [
    { "id": "…", "label": "…", "sublabel": "…" }
  ],
  "total": 0,
  "page": 1,
  "size": 25,
  "pageCount": 1
}
```

`label` und `sublabel` entstehen in `shared/picker-labels.ts` — an **einer**
Stelle, für Server und Oberfläche gemeinsam. Beim Vorgänger standen sie an
sechs Stellen; die Liste zeigte einen Namen, und die Selbstauswahl nach dem
Anlegen suchte einen anderen (B-087).

## Besonderheiten

Archivierte Kunden erscheinen nicht — ein archivierter Kunde soll nicht versehentlich auf einer neuen Rechnung landen.

## Fehler

| Status | Bedingung | Nachricht |
| --- | --- | --- |
| 401 | keine Sitzung | Bitte melden Sie sich an. |
| 403 | Recht fehlt | Sie haben keine Berechtigung für Kunden. |
| 422 | Eingabe unbrauchbar | Feldfehler unter `data.fields` |

## Geprüft wird das so

`test/integration/pickers.test.ts` fährt den Endpoint gegen eine echte
Datenbank: Wächter, Suche, Blättern, Archivfilter und die Antwortform. Der
Dienst dahinter heißt `pickCustomers` in `server/services/picker-service.ts`.

## Siehe auch

- [Die Auswahlen](../ui/picker.md) — die Oberfläche dazu
- [API](README.md)
