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
[Tabellen](tabellen.md) — 51 Tabellen, Stand des Arbeitspakets T-005.

Der Katalog des Vorgängersystems steht zum Vergleich im
[Datenmodell-Inventar](../rewrite/inventar/datamodel.md).
