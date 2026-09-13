---
title: Die Auswahlen
kategorie: ui
status: umgesetzt
updated: 2026-09-13
---

# Die Auswahlen

Eine Beziehung zu einem anderen Datensatz wird **immer** über eine Auswahl
gewählt: `EntityPicker` für einen, `MultiEntityPicker` für mehrere. Nie ein
`<select>`, nie eine Filterung im Browser.

Zurück zum [Komponentenkatalog](README.md).

## Warum nicht `<select>`

Ein Klappfeld listet alles auf, was es gibt. Bei zweitausend Kunden ist das
keine Auswahl, sondern eine Zumutung — und die Übertragung von zweitausend
Kunden für einen Klick. Gesucht wird dort, wo die Daten liegen: auf dem
Server, 25 Treffer je Seite.

## EntityPicker

```vue
<EntityPicker
  v-model="form.customerId"
  path="/api/pickers/customers"
  entity="Kunde"
  :display="customerName"
  :on-create="startCustomerCreation"
/>
```

### Eigenschaften

| Name       | Pflicht | Bedeutung                                                        |
| ---------- | ------- | ---------------------------------------------------------------- |
| `v-model`  | ja      | die gewählte Kennung, oder `null`                                |
| `path`     | ja      | der Endpoint, z. B. `/api/pickers/customers`                     |
| `entity`   | ja      | Was gewählt wird, im Singular: „Kunde", „Fahrzeug"               |
| `display`  | nein    | die Beschriftung des bereits Gewählten                           |
| `params`   | nein    | zusätzliche Einschränkung, etwa `{ scope: 'kunde', customerId }` |
| `disabled` | nein    | sperrt Auslöser und Entfernen-Knopf                              |
| `onCreate` | nein    | zeigt „Neu anlegen" im Kopf des Dialogs                          |

### Verhalten

- Der Dialog lädt **erst beim Öffnen**, nicht beim Rendern der Seite. Ein
  Formular mit fünf Auswahlen soll nicht fünf Abfragen auslösen, von denen
  vier niemand braucht.
- Die Suche ist **immer** entprellt (250 ms). Beim Vorgänger hing das daran,
  ob ein Rückruf übergeben wurde — dieselbe Komponente hatte zwei Bedeutungen
  (B-114).
- **Nur die jüngste Antwort schreibt.** Eine langsame ältere Antwort darf eine
  neuere nicht überschreiben (B-109).
- Ein Fehler wird **gezeigt**. Ohne Behandlung endete ein 403 als leerer
  Dialog ohne Erklärung, und der Nutzer hielt die Datenbank für leer (B-113).
- „Nichts gefunden" und „nicht geladen" sind zwei verschiedene Meldungen.

### Testselektoren

| Selektor                        | Element                          |
| ------------------------------- | -------------------------------- |
| `picker-<entity>`               | der Auslöser, Kleinschreibung    |
| `picker-clear`                  | entfernt die Wahl                |
| `picker-search`                 | das Suchfeld                     |
| `picker-option-<id>`            | ein Treffer                      |
| `picker-empty` · `picker-error` | die beiden Leerzustände          |
| `picker-create`                 | „Neu anlegen"                    |
| `picker-pagination`             | das Blättern, nur ab zwei Seiten |

## MultiEntityPicker

Für Beziehungen zu mehreren — etwa die Mitarbeiter an einer Auftragsposition.

**Transaktional:** was im Dialog angehakt wird, gilt erst mit „Übernehmen".
Wer abbricht oder Escape drückt, ändert nichts. Ein Dialog, der jedes Häkchen
sofort speichert, macht „Abbrechen" zur Lüge.

Der Knopf zählt mit: „Übernehmen (3)". Der Auslöser fasst zusammen: bei mehr
als zwei Gewählten „Anna, Bernd und 2 weitere".

### Testselektoren

`multi-picker-<entity>`, `multi-picker-search`, `multi-picker-option-<id>`,
`multi-picker-apply`, `multi-picker-cancel`, `multi-picker-error`.

## Zugänglichkeit

- **Der Auslöser trägt seinen eigenen Namen**: „Kunde wählen" beziehungsweise
  „Kunde: Meier GmbH. Ändern". In ein Formularfeld gewickelt las ein
  Screenreader sonst Feldbeschriftung und Dialogtext zusammen (B-096).
- **Das Suchfeld hat eine Beschriftung**, nicht nur einen Platzhalter (B-093).
  Sie ist `sr-only`, aber sie existiert.
- Der Dialog **behält den Titel von Nuxt UI**. Ein eigener Kopfbereich würde
  ihn verdrängen, und die Beschriftung des Dialogs zeigte ins Leere — deshalb
  hängt „Neu anlegen" im Slot `actions` und nicht in `header`.
- Fokusfang, Escape und die Rückgabe des Fokus an den Auslöser kommen von
  Nuxt UI. `test/browser/dialogs.test.ts` weist sie in einem echten Chromium
  nach.

## Neu anlegen, ohne zu verlieren, woran man war

Fehlt der Kunde, führt „Neu anlegen" auf die **vollständige** Kundenseite —
keine Schnellanlage in einem Dialog im Dialog. Den Formularstand sichert
`useCreationFlow()`; siehe [Anlegen aus einem Formular heraus](creation-flow.md).

## Grundlage

`UModal`, `UInput`, `UCheckbox`, `UPagination`, `UButton` aus Nuxt UI. Die
Suche kommt aus `server/services/picker-service.ts`, die Beschriftungen aus
`shared/picker-labels.ts`.

## Geprüft wird das so

| Ebene       | Datei                              | Was                                                                                |
| ----------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| Komponente  | `test/nuxt/picker.test.ts`         | Laden, Entprellen, Reihenfolge der Antworten, Fehlerfall, Übernehmen und Verwerfen |
| Browser     | `test/browser/dialogs.test.ts`     | Fokusfang, Escape, Rückgabe des Fokus, Bedienung nur mit der Tastatur              |
| Integration | `test/integration/pickers.test.ts` | Wächter, Serversuche, Blättern, Archivfilter                                       |
| Einheit     | `test/unit/picker-labels.test.ts`  | die Beschriftungen                                                                 |
