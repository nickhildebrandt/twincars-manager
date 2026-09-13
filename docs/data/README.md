---
title: Daten
kategorie: data
status: umgesetzt
updated: 2026-09-13
---

# Daten

Datenmodell der Anwendung: Tabellen, Spalten, Relationen, Indizes,
Migrationsstrategie und Startdaten.

Zurück zur [Übersicht](../index.md).

## Grundsätze

- **Drizzle ist die Wahrheit über das Datenbankschema**, Valibot die Wahrheit
  über Ein- und Ausgaben. Keins wird aus dem anderen erzeugt; ein Drift-Test
  hält beide zusammen.
- Schlüssel sind UUIDs, Zeitpunkte `timestamptz`, fachliche Tage `date`.
- Belege sind unveränderlich: Korrekturen laufen über eine Stornierung.
- Preise und Gehälter sind **versioniert**; Belege halten den damals gültigen
  Wert als Schnappschuss.
- **Geldbeträge sind ganze Zahlen in Cent**, nie Kommazahlen —
  [Geldbeträge](../architecture/money.md).
- **Ein Ereignisprotokoll** hält fest, wer wann was geändert hat. Weitere
  feldbezogene Versionstabellen gibt es nicht; es bleiben drei, bei denen ein
  Wert **ab einem Datum** gilt: Reifenpreis, Artikelpreis, Gehaltsstand
  ([09-modellaenderungen.md](../rewrite/09-modellaenderungen.md) M-01).
- **Ein ausgestellter Beleg friert ein**: Firmendaten, Kundenname und
  -anschrift, Bezeichnungen und Preise stehen als Kopie darin. Zieht ein Kunde
  um, ändert sich seine Rechnung von 2019 nicht (M-03).
- Kunden, Fahrzeuge, Lieferanten und Mitarbeiter lassen sich **archivieren**.
  Löschen ist möglich und nimmt mit, was zum Datensatz gehört; sobald eine
  ausgestellte Rechnung daranhängt, bleibt nur das Archiv —
  [Löschen und Archivieren](../architecture/loeschen-und-archivieren.md).

## Migrationen

Migrationen laufen **nie** im Request, sondern einmal vor dem Serverstart.
Jede ist wiederholbar geschrieben. Einzelheiten:
[Migrationsstrategie im Plan](../rewrite/03-architektur.md).

## Vollständigkeit

Die Tabellenübersicht entsteht mit `pnpm docs:data` aus dem Drizzle-Schema:
[Tabellen](tabellen.md) — 54 Tabellen, Stand nach der Modelldurchsicht.

Der Katalog des Vorgängersystems steht zum Vergleich im
[Datenmodell-Inventar](../rewrite/inventar/datamodel.md).
