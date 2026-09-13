---
title: GET /api/pickers/vehicles
kategorie: api
method: GET
path: /api/pickers/vehicles
permission: vehicles
status: umgesetzt
features: []
schemas: ['pickerQuerySchema']
updated: 2026-09-13
---

# GET /api/pickers/vehicles

Die Auswahl für Fahrzeuge: serverseitig gesucht, serverseitig geblättert, fest
25 je Seite.

Eine Beziehung wird **nie** über ein `<select>` gewählt und **nie** im Browser
gefiltert. Bei zweitausend Kunden wäre eine Auswahlliste keine Auswahl, und
eine Filterung im Browser hieße, zweitausend Kunden zu übertragen.

## Berechtigung

`vehicles` — die Absage nennt den Bereich auf Deutsch:
„Sie haben keine Berechtigung für Fahrzeuge."

## Eingabe

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `page` | nein | Seitenzahl ab 1; Vorgabe 1 |
| `q` | nein | Suchbegriff; gesucht wird über Marke, Modell, Fahrgestellnummer und **jedes Kennzeichen**, das das Fahrzeug je trug |
| `scope` | nein | `alle` (Vorgabe), `kunde` oder `bestand` |
| `customerId` | nein | Kennung des Kunden; nur mit `scope=kunde` sinnvoll |

Geprüft wird mit `pickerQuerySchema` beziehungsweise `scopedPickerQuerySchema`
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

Archivierte Fahrzeuge erscheinen nicht. Über `scope` lässt sich einschränken: `alle`, `kunde` (mit `customerId`) oder `bestand`.

## Fehler

| Status | Bedingung | Nachricht |
| --- | --- | --- |
| 401 | keine Sitzung | Bitte melden Sie sich an. |
| 403 | Recht fehlt | Sie haben keine Berechtigung für Fahrzeuge. |
| 422 | Eingabe unbrauchbar | Feldfehler unter `data.fields` |

## Geprüft wird das so

`test/integration/pickers.test.ts` fährt den Endpoint gegen eine echte
Datenbank: Wächter, Suche, Blättern, Archivfilter und die Antwortform. Der
Dienst dahinter heißt `pickVehicles` in `server/services/picker-service.ts`.

## Siehe auch

- [Die Auswahlen](../ui/picker.md) — die Oberfläche dazu
- [API](README.md)
