---
title: Zeitstrahl und Verlaufskurven
kategorie: ui
status: umgesetzt
updated: 2026-09-13
---

# Zeitstrahl und Verlaufskurven

Zwei Darstellungen aus den Modelländerungen: **M-02** (Historie ist ein
Zeitstrahl, keine Tabelle) und **M-35** (Kennzahlen als Verlauf, immer
gerechnet).

Zurück zum [Komponentenkatalog](README.md).

## Timeline (M-02)

Wo es eine Historie gibt, wird sie als Zeitstrahl gezeigt: beim Fahrzeug die
Halter- und Kennzeichenwechsel, beim Beleg der Statusverlauf, beim Auftrag die
Tafel, bei Preisen und Löhnen der Verlauf.

Eine Tabelle beantwortet „was stand wann drin". Ein Zeitstrahl beantwortet „was
ist passiert" — und das ist die Frage, die jemand stellt, der eine Historie
öffnet.

```vue
<Timeline :entries="entries" />
```

Ein Eintrag trägt `id`, `date` (`YYYY-MM-DD`), `title`, wahlweise
`description`, `actor`, `tone` und `icon`. Voreinstellung: neueste zuerst; für
einen Preisverlauf ist `:newest-first="false"` richtig.

Die Komponente **rechnet nichts und lädt nichts nach**. Sie stellt dar. Das
Datum steht als `<time datetime="…">` — deutsch lesbar und maschinenlesbar
zugleich. Die Einträge stehen in einer `<ol>`, weil ein Zeitstrahl eine
Reihenfolge ist und ein Screenreader sie hören soll.

## TrendChart (M-35)

Eine Linie, eine Fläche darunter, ein hervorgehobener letzter Punkt, eine
Achse mit runden Beschriftungen. Keine Diagrammbibliothek: das hier ist eine
Handvoll Koordinaten, und ein Diagrammpaket brächte Farbwelten mit, die nicht
zur Anwendung gehören.

```vue
<TrendChart :points="points" :format="formatEuro" label="Umsatz" />
```

**Die Zahlen kommen gerechnet herein und werden nirgends zwischengespeichert**
(P-09). Ein gespeicherter Kennwert läuft auseinander, sobald jemand eine alte
Buchung korrigiert — und dann zeigt das Diagramm etwas anderes als die Liste
darunter, und niemand glaubt mehr einem von beidem.

Die Achse beginnt bei null, solange alle Werte positiv sind: eine
abgeschnittene Achse lässt einen Anstieg von zwei Prozent aussehen wie eine
Verdopplung. Enthält die Reihe negative Werte, wird symmetrisch gerundet,
damit die Nulllinie sichtbar bleibt. Die Rechnung steht in `shared/chart.ts`
und ist dort geprüft.

**Ein Diagramm allein ist keine Auskunft.** Unter der Zeichnung steht dieselbe
Reihe als Tabelle, `sr-only`. Wer das Bild nicht sehen kann, bekommt die
Zahlen trotzdem.

## StatTile

Zahl, Bezeichnung, und wenn es hilft der Vergleich zum Vorzeitraum. Bei einer
Veränderung von null erscheint **kein** Vergleich: „±0 %" in Grün oder Rot wäre
eine Aussage, die niemand getroffen hat.

## Testselektoren

`timeline`, `timeline-entry-<id>`, `timeline-empty` · `trend-chart`,
`trend-latest`, `trend-empty` · `stat-tile`, `stat-value`, `stat-change`.

## Geprüft wird das so

`test/nuxt/display-components.test.ts` für die Darstellung,
`test/unit/chart.test.ts` für die Rechnung — einschließlich der Zusage, dass
der Bestand gerechnet und nicht gespeichert wird (P-09).
