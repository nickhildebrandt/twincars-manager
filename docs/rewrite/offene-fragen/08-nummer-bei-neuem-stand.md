# 08 — Bekommt ein neuer Stand eine neue Nummer?

**Betrifft:** M-41, M-14, M-44, T-021, T-022 · **Stand:** **entschieden am
20.09.2026** — Weg B beim Kostenvoranschlag, Weg A bei der Rechnung

## Worum es geht

Seit dem 20.09.2026 entwickelt sich ein Beleg in Ständen: Version 1, 2, 3 …,
gültig ist der letzte. Offen ist, **wie diese Stände heißen**.

Ein Kunde bekommt den Kostenvoranschlag „KV-2026-0042" und ruft an. Sie ändern
zwei Positionen. Was steht auf dem Ausdruck, den er als Nächstes bekommt?

## Die beiden Wege

| | **A — neue Nummer je Stand** | **B — eine Nummer, ein Zusatz** |
| --- | --- | --- |
| Der zweite Stand heißt | `KV-2026-0043` | `KV-2026-0042-2` |
| Der Kunde sieht | zwei Belege, die er vergleichen muss | einen Beleg in zweiter Fassung |
| Am Telefon | „Welche Nummer haben Sie da?" ist eindeutig | „Die 42 — welche Fassung?" |
| Der Nummernkreis | zählt jeden Stand mit | zählt Vorgänge |
| Bei Rechnungen | ohnehin zwingend (Storno + neue Nummer) | geht **nicht** |

## Was daran hängt

**Bei Rechnungen ist es entschieden**, und zwar nicht von uns: ein Storno und
eine Neuausstellung sind zwei Belege mit zwei Nummern. Das ist die Form, die
die Buchhaltung verlangt. Weg B ist dort ausgeschlossen.

**Beim Kostenvoranschlag ist es frei.** Er hat keine Lückenlosigkeitspflicht
(M-15), also darf seine Nummer aussehen, wie es dem Betrieb hilft.

Damit steht aber die Frage im Raum, ob man zwei verschiedene Schreibweisen
will — bei der Rechnung neue Nummern, beim Kostenvoranschlag Fassungen. Das
ist uneinheitlich, aber es bildet ab, was tatsächlich verschieden ist.

## Was heute umgesetzt ist

**Weg A**, für beide Belegarten. Der Grund ist Vorsicht, nicht Überzeugung:
eine Nummer, die es nur einmal gibt, ist an jeder Stelle die einfachere — in
der Suche, am Telefon, im Kassenbuch, auf dem Kontoauszug. Ein Zusatz `-2`
wandert erfahrungsgemäß irgendwann verloren, und dann liegen zwei verschiedene
Ausdrucke mit derselben Nummer auf dem Tisch.

## Was ich empfehle

**Weg A beibehalten**, und die Zusammengehörigkeit stattdessen in der
**Oberfläche** zeigen: die Liste führt je Kette nur den gültigen Stand, die
Detailseite trägt den Zeitstrahl mit allen Ständen, und der Ausdruck nennt im
Kopf „ersetzt KV-2026-0042 vom 3. März".

Dann ist jede Nummer eindeutig, und trotzdem sieht jeder — auch der Kunde —,
dass es derselbe Vorgang ist.


---

## Entschieden am 20.09.2026 — je Belegart anders

> „Kostenvoranschlag: fortlaufend als Zusatz an der bestehenden Nummer, also
> KV-0042-2. Keine neue eigene Nummer je Iteration. Rechnung: bleibt beim
> Schema der Buchhaltung — eine korrigierte Rechnung bekommt eine ganz andere,
> neue Rechnungsnummer, lückenlos fortlaufend und nie doppelt.“

Also **Weg B für den Kostenvoranschlag** und **Weg A für die Rechnung**.
Meine Empfehlung war einheitlich Weg A; die Entscheidung bildet ab, was
tatsächlich verschieden ist, und das ist die bessere Antwort.

Dazu die Altnummern:

> „Die alten Nummern müssen weiter auffindbar und gültig bleiben und dürfen
> nicht umnummeriert werden. Die neuen Nummern dürfen einem anderen Schema
> folgen; das ist rechtlich in Ordnung, solange im neuen Kreis lückenlos und
> eindeutig weitergezählt wird.“

**Was daraufhin geschah.** Die Regel steht als **M-44**, einmal im Code
(`shared/document-number.ts`) und mit dreizehn Unit-Tests belegt. Der
Beispiel-Export wurde gelesen statt vermutet; die Zahlen stehen in M-44 und in
T-033.

**Ein Entwurf ist dabei gescheitert und wurde ersetzt.** Er zerlegte
`KV-2026-0042-3` in Grundnummer und Zähler. Das ist zweideutig, und die Tests
haben es sofort gezeigt: die Grundnummer endet selbst auf `-0042`. Jetzt wird
**nachgeschlagen** statt zerlegt — die Grundnummer ist die Nummer von Stand 1
derselben Kette, und die steht in der Datenbank.
