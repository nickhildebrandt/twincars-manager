---
title: Löschen und Archivieren
kategorie: architecture
status: geplant
updated: 2026-09-13
---

# Löschen und Archivieren

Es gibt zwei Wege, einen Datensatz aus dem Alltag zu nehmen. **Archivieren** ist
der ruhige: der Datensatz bleibt, verschwindet aus Listen, Auswahlfeldern und
der Suche, und lässt sich jederzeit zurückholen. **Löschen** ist endgültig und
nimmt mit, was zum Datensatz gehört.

Zurück zur [Architektur](README.md) ·
[Entscheidung E-11](../rewrite/08-entscheidungen.md)

> **Stand:** Die Löschregeln stehen in der Datenbank (Arbeitspaket T-005). Die
> Oberfläche mit Vorschau und Sperre entsteht mit T-011.

## Archivieren

Möglich für Kunden, Fahrzeuge, Lieferanten und Mitarbeiter. Ein archivierter
Datensatz taucht in keiner Liste, keiner Auswahl und keiner Suche mehr auf,
bleibt aber in jedem Beleg, der ihn nennt. Archivieren ist **immer** erlaubt und
immer umkehrbar.

## Löschen

Löschen ist ausdrücklich erwünscht, nicht geduldet. Wer einen Datensatz
irrtümlich angelegt hat, soll ihn loswerden können.

### Was mitgeht

Beim Löschen eines **Kunden** geht mit, was ihm gehört: Aufträge, Termine,
Anfragen, Verkäufe. **Sein Fahrzeug nicht** — das überlebt ihn und wechselt in
den Bestand oder zu einem neuen Halter (M-05). Der Bestätigungsdialog **zählt
vorher genau auf, was verschwindet**, zum Beispiel:

> Kunde Meier GmbH löschen? Mitgelöscht werden: 7 Aufträge, 2
> Kostenvoranschläge, 5 Termine. Die 3 Fahrzeuge bleiben und gehen in den
> Bestand. Das lässt sich nicht rückgängig machen.

Beim Löschen eines **Fahrzeugs** geht nur dieses Fahrzeug samt seiner Fotos,
Papiere, Kennzeichen- und Halterhistorie, Radsätze, Ankaufs- und
Verkaufsdaten. Beim Löschen eines
**Auftrags** gehen nur seine Positionen und Zuweisungen. Die daraus
entstandenen Rechnungen bleiben in beiden Fällen.

### Wann nicht gelöscht wird

**Sobald eine ausgestellte Rechnung am Datensatz hängt, ist Löschen gesperrt.**
Die Anwendung bietet dann Archivieren an und sagt auch warum: eine ausgestellte
Rechnung unterliegt der Aufbewahrungspflicht und wird storniert, nie gelöscht
([ADR-015](../decisions/adr-015-storno-instead-of-delete.md)). Dasselbe gilt für
Buchungen im Kassenbuch.

Die Sperre steht an zwei Stellen: der Dienst prüft sie und antwortet mit einem
deutschen Satz, und die Datenbank hält als letzte Verteidigungslinie dagegen.

## Die Regeln in der Datenbank

| Was am Kunden hängt                                                               | Regel                |
| --------------------------------------------------------------------------------- | -------------------- |
| Fahrzeuge, Aufträge, Termine, Anfragen, Zeiteinträge, Reifeneinlagerung, Verkäufe | geht mit (`cascade`) |
| Belege, Kassenbuchzeilen                                                          | sperrt (`no action`) |

| Was am Fahrzeug hängt                                 | Regel                |
| ----------------------------------------------------- | -------------------- |
| Fotos, Papiere, Kennzeichen, Ankauf, Verkauf, Inserat | geht mit (`cascade`) |
| Belege, Aufträge, Termine, Reifeneinlagerung          | sperrt (`no action`) |

**Kein Verweis wird mehr stillschweigend auf `NULL` gesetzt** — das war Befund
B-190. Der Löschwächter zählt jeden Fremdschlüssel und benennt ihn.

Es gibt genau zehn Stellen, an denen ein Verweis doch auf `NULL` geht, und an
jeder ist das die gemeinte Folge — zum Beispiel: ein Rechnungsentwurf wird
gelöscht, also ist die Arbeitszeit wieder unabgerechnet und der Auftrag wieder
abrechenbar. Die zehn stehen namentlich mit Begründung im Test
`schema-drift.test.ts`; eine elfte, die dort nicht steht, lässt ihn scheitern.

Die Sperre ist bewusst `no action` und nicht `restrict`: `no action` wird erst
am Ende der Anweisung geprüft. Eine berechtigte Kaskade, die die verweisende
Zeile im selben Zug entfernt, bleibt damit möglich; `restrict` würde auch dann
abbrechen.

Geprüft wird das in `test/integration/schema-drift.test.ts`: jede Regel
einzeln, dazu ein Kunde, der sein Fahrzeug und seinen Auftrag mitnimmt, und
einer, den seine Rechnung am Löschen hindert.

Siehe auch: [Datenmodell](../data/README.md) · [Geldbeträge](money.md)
