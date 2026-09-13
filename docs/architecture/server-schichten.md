---
title: Serverschichten
kategorie: architecture
status: umgesetzt
updated: 2026-09-13
---

# Serverschichten

Drei Schichten, klar getrennt. Wer das einhält, kann Fachlogik ohne HTTP prüfen
und HTTP ohne Datenbank.

Zurück zur [Architektur](README.md).

| Schicht       | Ort                  | Aufgabe                                                                             |
| ------------- | -------------------- | ----------------------------------------------------------------------------------- |
| Endpoint      | `server/api/**`      | Wächter, Validierung, Dienstaufruf. Sonst nichts.                                   |
| Fachlogik     | `server/services/**` | Regeln und Datenbankzugriff. Bekommt einfache Argumente, **nie** das Anfrageobjekt. |
| Infrastruktur | `server/utils/**`    | Verbindung, Transaktion, Krypto, Nummern, Drossel, Wächter.                         |

Ein Endpoint sieht immer gleich aus:

```ts
export default defineEventHandler(async (event) => {
  requirePermission(event, 'customers') // 1. Wächter
  const query = await useValidatedQuery(event, customerListSchema) // 2. Valibot
  return listCustomers(query) // 3. Dienst
})
```

Der Wächter steht zuerst, vor jedem Datenbankzugriff. Beim Vorgänger stand er
mitunter nach der ersten Abfrage, und drei Endpunkte hatten gar keinen
(B-002, B-003).

## Die Infrastruktur im Einzelnen

### Verbindung und Transaktion — `db.ts`

`useDatabase()` öffnet den Verbindungspool einmal je Prozess. `withTransaction`
ist **Pflicht**, sobald mehr als eine Anweisung schreibt. Der Vorgänger hatte in
33 000 Zeilen Dienstcode keine einzige Transaktion; jede mehrstufige Änderung
konnte die Hälfte ihrer Arbeit liegen lassen.

`createDatabase(optionen)` baut den Client aus übergebenen Optionen. Die Tests
benutzen dieselbe Funktion, damit es keine zweite, leicht abweichende
Verbindung gibt.

### Wächter — `guards.ts`

`requireUser`, `requirePermission`, `requireAnyPermission`. Sie lesen
`event.context.auth`, das die Sitzungs-Middleware füllt, und werfen 401
beziehungsweise 403 mit einem deutschen Satz, der den Bereich benennt —
„Sie haben keine Berechtigung für Einstellungen." statt „Forbidden".

`requireAnyPermission` gibt es, weil die Werkstatt am Auftrag Mitarbeiter und
Artikel auswählt, ohne die Personal- oder Katalogberechtigung zu halten.

### Listen — `pagination.ts`

`sliceFor(query, spalten, rückfall)` baut `ORDER BY`, `LIMIT` und `OFFSET`.
Fest 25 Zeilen, kein Größenwähler. Sortiert wird nur nach Spalten aus einer
**Weißliste** — der Sortierwunsch ist eine Zeichenkette aus dem Netz. Ein
unbekannter Name führt nicht zum Fehler, sondern zur Standardsortierung: ein
altes Lesezeichen soll die Liste zeigen.

Die Rückfallspalte wird immer als Stichentscheid angehängt. Ohne sie können
Zeilen mit gleichem Sortierwert auf zwei Seiten oder auf keiner erscheinen.

### Nummern — `numbering.ts`

`allocateNumber(ausführer, art)` erhöht den Zähler mit **einer** Anweisung und
gibt die Nummer zurück. PostgreSQL sperrt die Zeile für die Dauer der
Anweisung, also bekommen zwei gleichzeitige Aufrufe nie dieselbe Nummer.

Der Aufrufer übergibt den Ausführer. Innerhalb einer Transaktion wird die
Nummer mit allem anderen zurückgerollt, die Folge bleibt lückenlos (B-304).

`peekNumber` zeigt die nächste Nummer für die Vorschau in den Einstellungen und
darf nie zur Entscheidung dienen — zwischen Vorschau und Schreiben kann sie
jemand anders nehmen.

### Geheimnisse — `crypto.ts`

AES-256-GCM, Format `v1:iv:tag:daten`. Nur für Geheimnisse, die die Anwendung
zurücklesen muss: SMTP-Passwort und eBay-Token. Fachdaten werden **nicht**
verschlüsselt — das kostet jede Abfrage ihre Indizes und bringt nichts, denn
wer die Datenbank lesen kann, kann auch den Schlüssel lesen.

Es gibt keinen eingebauten Ersatzschlüssel. Der Vorgänger fiel still auf ein
festes Entwicklungsgeheimnis zurück, sodass eine Produktivinstanz mit öffentlich
bekanntem Schlüssel laufen konnte (B-018).

Alte Klartextzeilen werden unverändert durchgereicht; das nächste Speichern
schreibt sie verschlüsselt zurück.

### Drossel — `rate-limit.ts`

Fester Ein-Minuten-Zähler im Prozessspeicher, für die Anmeldung und die
öffentliche Schnittstelle. Ein Grenzwert von null sperrt vollständig, auch den
ersten Aufruf. Die Anwendung läuft als eine Instanz; ein gemeinsamer Speicher
wäre eine Betriebsabhängigkeit ohne Gewinn.

### Zeit — `shared/datetime.ts`

Genau eine Geschäftszeitzone: **Europe/Berlin**. Der Vorgänger benutzte die
Prozesszeit für Nummernkreise und UTC für die Auswertungen; in den ersten ein
bis zwei Stunden jedes Tages zeigte das Dashboard den Vortag, und die Jahreszahl
in einer Rechnungsnummer hing von der Container-Einstellung ab (B-028).

Ein Datum wird als Mittag gelesen, nicht als Mitternacht — Mitternacht UTC ist
in manchen Zonen der Vortag.

## Wiederkehrende Arbeit

`server/tasks/_registry.ts` erklärt jede Aufgabe einmal: Name, Beschriftung,
Zeitplan, nötige Berechtigung. Daraus baut `nuxt.config.ts` den Nitro-Zeitplan,
und derselbe Name lässt sich über „Jetzt prüfen" von Hand auslösen. Zeitplan
und Umsetzung können so nicht auseinanderlaufen.

Der Zeitplan läuft werktags um 7:30 Uhr
([Entscheidung E-12](../rewrite/08-entscheidungen.md)). `TASKS_SCHEDULE=off`
legt ihn still, ohne die Knöpfe abzuschalten. Jede Aufgabe muss
wiederholsicher sein: zweimal ausgeführt verschickt sie nichts doppelt.

Siehe auch: [Validierung und Fehler](validation-and-errors.md) ·
[Geldbeträge](money.md) · [Datenmodell](../data/README.md) ·
[GET /api/health](../api/health-get.md)
