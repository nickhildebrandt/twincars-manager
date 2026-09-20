# 13 — Zwölf Zeichen Mindestlänge: zu viel für den Alltag?

**Betrifft:** P-14, T-010, T-034 · **Stand:** offen, vorläufig auf zwölf

## Worum es geht

Das Passwort ist die **einzige** Hürde — einen zweiten Faktor gibt es
bewusst nicht (M-36). Ich habe die Mindestlänge auf **zwölf Zeichen** gesetzt
und **keine** Zusammensetzungsregeln aufgestellt.

Das ist eine Entscheidung mit Alltagsfolgen, und sie trifft jeden im Betrieb
jeden Tag. Deshalb steht sie hier und nicht nur im Code.

## Warum zwölf und nicht acht

Acht Zeichen sind heute mit einer einzelnen Grafikkarte in Stunden
durchprobiert, falls jemand an die Passwort-Hashes kommt. Zwölf ist die Länge,
ab der die Rechnung für den Angreifer nicht mehr aufgeht.

## Warum keine Sonderzeichenpflicht

Weil sie genau ein Passwort erzeugt: `Passwort1!`. Es erfüllt jede solche
Regel — Großbuchstabe, Ziffer, Sonderzeichen — und steht in jeder Leckliste
der Welt. Die Regel fühlt sich streng an und ist es nicht.

Stattdessen prüft die Anwendung auf **Muster**: Wort plus Jahreszahl
(`sommer2024`), Tastaturreihen, Ziffernersetzung (`P4ssw0rt`), den eigenen
Namen, den Firmennamen. Das fängt, was Menschen wirklich wählen.

## Was das im Alltag heißt

Eine Losung aus drei Wörtern geht durch und ist leicht zu merken:

- `kupplung wechsel dienstag` — 25 Zeichen, in Ordnung
- `nordseewindmuehle` — 17 Zeichen, in Ordnung
- `Auto2026!` — 9 Zeichen, **abgelehnt** (zu kurz, und Wort plus Jahreszahl)

Leerzeichen sind erlaubt und ausdrücklich erwünscht.

## Was zur Wahl steht

| | **A — zwölf (heute)** | **B — zehn** | **C — vierzehn** |
| --- | --- | --- | --- |
| Sicherheit | ausreichend | grenzwertig | gut |
| Akzeptanz im Betrieb | eine Losung nötig | ein langes Wort reicht | Losung zwingend |
| Empfehlungen des BSI | entspricht | darunter | darüber |

## Was ich empfehle

**Bei zwölf bleiben.** Es ist die Grenze, an der Länge anfängt zu helfen, und
eine Losung aus drei Wörtern erreicht sie ohne Mühe — leichter als
`Xk7!mQ2z`, das niemand behält und das deshalb auf einem Zettel unter der
Tastatur landet.

**Was ich von Ihnen bräuchte:** ein Ja — oder ein „zehn reicht", wenn Sie den
Betrieb kennen und zwölf für zu sperrig halten. Die Zahl steht an genau einer
Stelle (`MINIMUM_LENGTH`) und ist in einer Minute geändert.
