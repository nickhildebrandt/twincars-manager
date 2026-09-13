---
title: Geldbeträge
kategorie: architecture
status: umgesetzt
updated: 2026-09-13
---

# Geldbeträge

**Jeder Betrag in dieser Anwendung ist eine ganze Zahl in Cent.** Spalte,
Nutzlast, Schema, Rechnung — überall Cent, nirgends Euro. Euro gibt es nur an
den beiden Rändern: dort, wo jemand einen Betrag eintippt, und dort, wo ein
Betrag auf dem Bildschirm oder im PDF erscheint.

Zurück zur [Architektur](README.md) · [Entscheidung E-10](../rewrite/08-entscheidungen.md)

## Warum

Der Vorgänger führte Beträge als `numeric` in der Datenbank und rechnete in
JavaScript mit Fließkommazahlen. Beides zusammen ergibt Summen, die um einen
Cent danebenliegen, und zwar unregelmäßig: `0.1 + 0.2` ist als Fließkommazahl
nicht `0.3`. In einer Rechnungssumme ist das kein Schönheitsfehler, sondern ein
Fehler. Ganze Zahlen addieren sich exakt.

## Die Regeln

| Ort                          | Form                                                |
| ---------------------------- | --------------------------------------------------- |
| Datenbankspalte              | `integer`, Inhalt sind Cent                         |
| Nutzlast einer Schnittstelle | ganze Zahl, Cent                                    |
| Valibot-Schema               | `moneySchema` bzw. `positiveMoneySchema`            |
| Fachlogik                    | ganze Zahlen, Hilfsfunktionen aus `shared/money.ts` |
| Oberfläche                   | `formatEuro` beim Anzeigen, `parseEuro` beim Lesen  |

Die Obergrenze ist `MAX_MONEY_CENTS` = 2.147.483.647, also 21.474.836,47 €.
Das ist genau das, was eine `integer`-Spalte trägt: **das Schema hört dort auf,
wo die Spalte aufhört.** Ein Schema, das mehr durchlässt als die Spalte fasst,
macht aus einem Tippfehler einen Serverfehler — das war Befund B-556.

## Die Hilfsschicht

`shared/money.ts` ist die einzige Stelle, an der Cent und Euro aufeinander
treffen.

| Funktion                          | Zweck                                 |
| --------------------------------- | ------------------------------------- |
| `parseEuro('1.234,56 €')`         | liest, was jemand tippt — oder `null` |
| `formatEuro(123456)`              | `1.234,56 €`                          |
| `formatAmount(123456)`            | `1.234,56`, ohne Währungszeichen      |
| `sumCents([…])`                   | exakte Summe                          |
| `applyPercent(10000, 19)`         | `1900`                                |
| `addVat(10000, 19)`               | `11900`                               |
| `splitVat(11900, 19)`             | `{ net: 10000, tax: 1900 }`           |
| `lineTotal(preis, menge, rabatt)` | eine Belegposition                    |

Zwei Feinheiten, die bewusst so sind:

- **Gerundet wird kaufmännisch von der Null weg.** `Math.round` rundet negative
  Halbe zur Null hin; bei Gutschriften ergäbe das den falschen Cent.
- **`splitVat` rundet nur den Nettobetrag, die Steuer ist der Rest.** Damit ist
  netto plus Steuer immer genau der Bruttobetrag, den der Kunde zahlt. Beide
  Werte einzeln zu runden lässt die Summe um einen Cent abweichen.

`parseEuro` nimmt an, was Menschen wirklich tippen: `1.234,56`, `1234,56`,
`1234.56`, `1 234,56`, mit oder ohne `€`, mit führendem Minus. Drei
Nachkommastellen werden **abgelehnt** statt stillschweigend gerundet — wer
`1,234` tippt, meinte etwas anderes, und Raten ist schlechter als Nachfragen.

## Was das nicht betrifft

Prozentsätze, Mengen, Stunden, Profiltiefen und Geokoordinaten bleiben
`numeric`. Sie sind keine Beträge, und bei ihnen ist die Nachkommastelle der
Punkt.

## Geprüft wird das so

Der Drift-Test in `test/integration/schema-drift.test.ts` vergleicht den Typ
jeder Spalte mit dem, was Drizzle deklariert, listet die verbliebenen
`numeric`-Spalten namentlich auf und weist eine Buchung mit einem halben Cent
an der Datenbank ab. `test/unit/money.test.ts` prüft jede Funktion samt
Rundungsgrenzen.

Siehe auch: [Datenmodell](../data/README.md) ·
[Validierung und Fehler](validation-and-errors.md)
