---
title: GET /api/pickers/documents
kategorie: api
method: GET
path: /api/pickers/documents
permission: invoices
status: umgesetzt
features: []
schemas: ['pickerQuerySchema']
updated: 2026-09-13
---

# GET /api/pickers/documents

Die Auswahl für Belege: serverseitig gesucht, serverseitig geblättert, fest
25 je Seite.

Eine Beziehung wird **nie** über ein `<select>` gewählt und **nie** im Browser
gefiltert. Bei zweitausend Kunden wäre eine Auswahlliste keine Auswahl, und
eine Filterung im Browser hieße, zweitausend Kunden zu übertragen.

## Berechtigung

`invoices` — die Absage nennt den Bereich auf Deutsch:
„Sie haben keine Berechtigung für Rechnungen."

## Eingabe

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `page` | nein | Seitenzahl ab 1; Vorgabe 1 |
| `q` | nein | Suchbegriff; gesucht wird über die Belegnummer |
| `customerId` | nein | schränkt auf die Belege eines Kunden ein |

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

Mit `customerId` nur die Belege dieses Kunden. Ein Beleg ohne Nummer ist ein Entwurf und heißt in der Liste „Rechnung Entwurf" — die Nummer wird erst beim Ausstellen gezogen (M-14).

## Fehler

| Status | Bedingung | Nachricht |
| --- | --- | --- |
| 401 | keine Sitzung | Bitte melden Sie sich an. |
| 403 | Recht fehlt | Sie haben keine Berechtigung für Rechnungen. |
| 422 | Eingabe unbrauchbar | Feldfehler unter `data.fields` |

## Geprüft wird das so

`test/integration/pickers.test.ts` fährt den Endpoint gegen eine echte
Datenbank: Wächter, Suche, Blättern, Archivfilter und die Antwortform. Der
Dienst dahinter heißt `pickDocuments` in `server/services/picker-service.ts`.

## Siehe auch

- [Die Auswahlen](../ui/picker.md) — die Oberfläche dazu
- [API](README.md)
