# 01 — Sperren Termin und Kostenvoranschlag wirklich das Löschen?

**Betrifft:** M-38, P-11, T-011 · **Stand:** **entschieden am 20.09.2026**

## Worum es geht

Sie haben gesagt: *„sobald da auch nur irgendwas für die Buchhaltung ist,
löschen wir nie, niemals."*

Ich habe das **strenger** umgesetzt, als Ihre Worte es verlangen — und sage es
deshalb hier, statt es stillschweigend zu tun.

## Wie es heute steht

Es sperrt **jeder eigene Vorgang**, nicht nur der buchhalterische:

| Was daran hängt | Sperrt heute | Buchhaltung? |
| --- | --- | --- |
| Rechnung, Zahlung, Buchung, Ankauf, Verkauf | ja | **ja** |
| Zahlungserinnerung, Gehaltsstand | ja | ja |
| **Kostenvoranschlag** | ja | **nein** |
| **Termin** | ja | **nein** |
| **Auftrag** | ja | eher nein |
| Radsatz | ja | nein (Inventar) |

## Warum ich es so gemacht habe

Die Grenze „was ist buchhalterisch relevant" ist im Einzelfall schwer zu
ziehen — ein Auftrag mit Preisen, aus dem nie eine Rechnung wurde, liegt genau
dazwischen. Die Grenze „hängt da etwas dran" ist es nicht. Und Sie hatten sich
in derselben Nachricht ausdrücklich in Richtung *weniger löschen* korrigiert
(„da wollte ich ein bisschen zu viel löschen").

Der Anwendungsfall fürs Löschen bleibt vollständig abgedeckt: *gerade angelegt,
sofort als Unsinn erkannt* — daran hängt nichts.

## Was zur Wahl steht

**A — so lassen.** Ein Datensatz, an dem irgendetwas hängt, wird archiviert.
Eine Regel, ein Satz, keine Grenzfälle.

**B — Termin und Kostenvoranschlag lockern.** Beide verlieren beim Löschen nur
ihren Verweis, der Eintrag bleibt stehen. Dann ist ein Fahrzeug, für das
jemand einen Kostenvoranschlag geschrieben hat, noch löschbar.

Der Aufwand für B ist gering: je Beziehung eine Zeile im Schema und ein
`UPDATE` im Löschvorgang. Der Preis ist, dass es wieder zwei Klassen von
Verweisen gibt.

## Empfehlung

**A.** „Es hängt etwas dran, also wird archiviert" ist ein Satz, den man einem
neuen Mitarbeiter in zehn Sekunden erklärt. Und Archivieren verliert nichts.


---

## Entschieden am 20.09.2026 — die strenge Lesart gilt

> „Ein Datensatz ist nur löschbar, wenn er null Verweise hat — weder eigene
> Verweise noch Verweise anderer Datensätze auf ihn. Anwendungsfall: frisch
> angelegter Datensatz, sofort als falsch erkannt → vollständig löschbar.
> Sobald irgendein Verweis existiert: kein Löschen mehr, nur noch archivieren."

**Was daraufhin geschah.** Sechzehn Fremdschlüssel standen noch auf „geht mit"
und wurden auf „sperrt" umgestellt. Übrig sind fünf Kaskaden, und keine davon
ist fachlich: Sitzung, Zugang und Rollenzuweisung gehören zum Benutzerkonto
und verschwinden mit ihm. Ein Test in `schema-drift.test.ts` prüft diese Liste
**abschließend** — kommt irgendwo sonst ein „geht mit" hinzu, fällt er.

Damit ist die Frage dieser Datei beantwortet: **ja**, ein Termin sperrt, und
ein Kostenvoranschlag ebenso. Es gibt keine Abstufung mehr nach Belegart.

Was daraus folgt, steht in [07-eigene-teile-beim-loeschen.md](07-eigene-teile-beim-loeschen.md).
