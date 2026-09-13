---
title: Listen, Tabellen und Filter
kategorie: ui
status: umgesetzt
updated: 2026-09-13
---

# Listen, Tabellen und Filter

Jede Liste der Anwendung folgt demselben Muster. Es steht einmal da, in
`useListQuery()` und `DataTable`, und nicht in zwanzig Seiten neu.

Zurück zum [Komponentenkatalog](README.md).

## Der Zustand steht in der Adresszeile

Filter, Suchbegriff, Sortierung und Seite stehen **in der Adresse**, nicht im
Speicher. Damit überlebt ein Lesezeichen den Tab, ein Neuladen zeigt dieselbe
Ansicht, ein kopierter Link gibt die Ansicht weiter, und der Zurück-Knopf
nimmt einen Filter zurück, statt aus der Liste herauszuspringen.

```ts
const list = useListQuery<Customer>({
  path: '/api/customers',
  filters: { kind: '', archived: '' },
  sort: 'name',
  dir: 'asc'
})
```

| Rückgabe                                            | Bedeutung                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `search`                                            | der Suchbegriff im Feld; läuft der Adresse um die Entprellung voraus |
| `page`, `filters`, `query`                          | der Zustand, wie er in der Adresse steht                             |
| `items`, `total`, `pageCount`, `pageSize`           | das Ergebnis                                                         |
| `pending`, `failed`, `empty`                        | die drei Zustände einer Liste                                        |
| `goToPage`, `setFilter`, `sortBy`, `reset`, `apply` | die Änderungen                                                       |

## Drei Zusagen, die sonst in jeder Liste neu schiefgehen

- **Ein Filterwechsel setzt auf Seite 1.** Sonst zeigt Seite 7 eines Filters
  mit vier Treffern nichts an, und der Nutzer hält die Liste für leer. Nur das
  Blättern selbst behält die Seite.
- **Das vorige Ergebnis bleibt stehen**, während das neue lädt. Eine Tabelle,
  die bei jedem Tastendruck leer blinkt, ist unbenutzbar. Auch nach einem
  Fehler bleibt es stehen — die Seite wird nicht geleert.
- **Antworten kommen in der Reihenfolge an, in der sie gebraucht werden.** Eine
  langsame ältere Antwort überschreibt keine neuere; beim Vorgänger passten
  Trefferlisten dadurch nicht zur Eingabe (B-109).

## Pagination

Fest **25** je Seite, serverseitig. Es gibt keinen Größenwähler, nirgends. Der
Vorgänger trug eine Funktion mit 10, 50 und 100 mit sich, die niemand aufrief
(B-026), und begrenzte die Seitenzahl nicht — `page=0` ergab einen negativen
Versatz und einen Serverfehler (B-149). Beides ist hier geprüft.

## DataTable

```vue
<DataTable
  :rows="list.items.value"
  :columns="columns"
  :to="(row) => `/customers/${row.id}`"
  :sort="list.query.value.sort"
  :dir="list.query.value.dir"
  :totals="{ number: 'Summe', total: formatEuro(sum) }"
  @sort="list.sortBy"
>
  <template #actions="{ row }">…</template>
</DataTable>
```

| Eigenschaft       | Bedeutung                                                              |
| ----------------- | ---------------------------------------------------------------------- |
| `rows`, `columns` | die Daten und ihre Beschreibung                                        |
| `to`              | wohin ein Klick auf die Zeile führt; ohne Angabe ist nichts anklickbar |
| `sort`, `dir`     | wonach gerade sortiert ist — die Tabelle sortiert **nicht** selbst     |
| `totals`          | eine Summenzeile im `<tfoot>`                                          |
| `caption`         | ein Name für Screenreader, nicht sichtbar                              |

Eine Spalte trägt `key`, `label` und wahlweise `value` (eigene Berechnung),
`numeric` (rechtsbündig, Ziffern in Tabellenbreite), `sortable` und
`secondary` (auf schmalen Geräten weglassen).

### Drei Regeln

- **Die ganze Zeile ist anklickbar.** Eine Tabelle, bei der man den einen
  unterstrichenen Text treffen muss, ist auf einem Werkstatt-Tablet
  unbedienbar.
- **Aktionen in der Zeile schlucken den Klick.** Sonst öffnet jeder Druck auf
  „Löschen" nebenbei die Detailseite.
- **Auf schmalen Geräten wird aus jeder Zeile eine Karte.** Eine Tabelle mit
  acht Spalten auf einem Telefon ist keine Tabelle.

Sortiert wird auf dem Server: der Browser kennt 25 von 2000 Zeilen, eine
Sortierung dort wäre eine Sortierung der sichtbaren Seite und damit falsch.
`DataTable` meldet den Wunsch nach außen und ändert nichts selbst.

Eine leere Zelle zeigt einen Gedankenstrich. Eine wirklich leere Zelle sieht
aus wie ein Fehler.

## Testselektoren

`data-table`, `data-cards`, `row-<id>`, `card-<id>`, `sort-<spalte>`.

## Geprüft wird das so

| Ebene       | Datei                                 | Was                                                                                       |
| ----------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Komponente  | `test/nuxt/use-list-query.test.ts`    | Adresszeile, Seitenrücksetzung, Entprellung, Reihenfolge der Antworten, Wiederherstellung |
| Komponente  | `test/nuxt/data-table.test.ts`        | Zeilenklick, geschluckter Klick, Summenzeile, Karten, Sortierwunsch                       |
| Browser     | `test/browser/list-url.test.ts`       | dass die Adresse sich wirklich ändert und einen Verlaufseintrag hinterlässt               |
| Integration | `test/integration/pagination.test.ts` | 25 je Seite, Sortierung, unsinnige Eingaben                                               |
