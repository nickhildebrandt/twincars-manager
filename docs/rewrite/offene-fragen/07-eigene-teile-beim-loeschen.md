# 07 — Was „null Verweise" für die eigenen Teile eines Datensatzes heißt

**Betrifft:** M-38, T-011, T-012, T-022 · **Stand:** **beantwortet am
20.09.2026** — über die Versionierung, nicht über die Löschregel

## Worum es geht

Ihre Festlegung vom 20.09.2026:

> „Ein Datensatz ist nur löschbar, wenn er null Verweise hat — weder eigene
> Verweise noch Verweise anderer Datensätze auf ihn. Anwendungsfall: frisch
> angelegter Datensatz, sofort als falsch erkannt → vollständig löschbar.
> Sobald irgendein Verweis existiert: kein Löschen mehr, nur noch archivieren."

Wörtlich gelesen gibt es eine Stelle, an der die Regel gegen ihren eigenen
Anwendungsfall läuft — und die will ich benennen, statt sie stillschweigend
auszulegen.

## Der Fall

Eine Rechnung hat **Positionen**. Eine Rechnung ohne Positionen gibt es nicht;
sie entstehen im selben Moment wie die Rechnung. Ein Fahrzeug hat eine
**Kennzeichenhistorie**, die beim Anlegen sofort den ersten Eintrag bekommt.
Ein Artikel hat eine **Preisversion**, sobald jemand einen Preis einträgt.

Das sind alles „Verweise anderer Datensätze auf ihn". Streng gelesen wäre eine
Rechnung also schon in der Sekunde ihrer Entstehung unlöschbar — und der von
Ihnen genannte Anwendungsfall („sofort als falsch erkannt, vollständig
löschbar") ginge nie auf.

## Wie ich es unterschieden habe

Zwei Arten von Verweis, und nur die erste sperrt:

| Art | Beispiel | Folge |
| --- | --- | --- |
| **Fremder Vorgang** — steht für sich, jemand könnte ihn suchen | eine Rechnung zum Fahrzeug, ein Termin, eine Buchung, ein eingelagerter Radsatz | **sperrt.** Nur noch archivieren. |
| **Eigener Teil** — existiert nur als Teil dieses Datensatzes und ist ohne ihn sinnlos | Rechnungsposition, Fahrzeugfoto, Kennzeichenhistorie, Preisversion, PDF-Abzug | wird beim Löschen **ausdrücklich mitgelöscht**, in derselben Transaktion |

## Was in der Datenbank steht

**Beides sperrt** — auf Ebene der Datenbank steht jeder dieser Fremdschlüssel
auf „sperrt". Auch die eigenen Teile. Der Unterschied liegt allein im
Löschdienst: er räumt die eigenen Teile vorher weg, den fremden Vorgang nicht.

Das ist Absicht und der eigentliche Gewinn dieser Umstellung: **nichts
verschwindet, weil die Datenbank es nebenbei mitnimmt.** Was gelöscht wird,
muss im Code genannt sein. Vergisst jemand einen eigenen Teil, scheitert das
Löschen mit einer Fremdschlüsselverletzung — laut und sofort, statt still.

Ein Test in `schema-drift.test.ts` prüft die Liste der verbliebenen „geht
mit"-Regeln **abschließend**. Es sind fünf, alle an der Anmeldung: Sitzung,
Zugang, Rollenzuweisung. Kommt irgendwo sonst eine hinzu, fällt der Test.

## Was Sie entscheiden müssten

**Stimmt die Trennung?** Konkret an zwei Grenzfällen:

1. **Rechnungspositionen.** Eine Rechnung ohne Nummer, ohne Zahlung, ohne
   Buchung — nur Positionen. Löschbar (meine Auslegung) oder nur archivierbar
   (wörtliche Lesart)?

2. **Fahrzeugfotos und Inserate.** Ein Fahrzeug, zu dem jemand zwanzig Fotos
   hochgeladen und ein eBay-Inserat angelegt hat, sonst nichts. Ist das
   „Beiwerk, das mitgeht", oder ist ein Inserat ein Vorgang, der sperrt?

Meine Empfehlung: **Positionen und Fotos sind eigene Teile** und gehen mit.
Ein **Inserat** ist ein Vorgang — es war draußen, jemand hat es gesehen — und
sperrt. So ist es zurzeit **nicht** umgesetzt; heute zählt `vehicle_listings`
als eigener Teil. Sagen Sie ein Wort, und es wandert in die andere Spalte.

---

## Beantwortet am 20.09.2026 — der Rahmen verschiebt die Frage

Die Antwort kam nicht als Ja/Nein zu den beiden Grenzfällen, sondern als
größerer Rahmen: **vertragswirksame Belege werden versioniert, und ihre
Abhängigkeiten werden beim Ausstellen abgeschrieben** (M-41, M-42, M-43).

Damit beantworten sich beide Grenzfälle von selbst, und zwar anders, als ich
gefragt hatte:

**1. Rechnungspositionen.** Die Frage war „löschbar oder nur archivierbar".
Beides ist jetzt die falsche Alternative. Ein Beleg, der noch nicht
ausgestellt ist, ist ein **Entwurf** — den bearbeitet man, und löschen heißt
ihn samt seiner Positionen wegräumen, in einer Transaktion (M-14: er hat noch
keine Nummer, hinterlässt also keine Lücke). Ein **ausgestellter** Beleg wird
nie gelöscht und auch nicht bearbeitet: er bekommt einen **neuen Stand**, und
der alte bleibt stehen. Die Positionen sind in beiden Fällen eigene Teile
ihres Standes.

**2. Fahrzeugfotos und Inserate.** Hier ist die Antwort ausdrücklich: „wenn es
verkauft wird und wo es hingeht — das muss wirklich solide dokumentiert sein."
Ein Inserat ist danach ein **Vorgang**: es war draußen, jemand hat es gesehen,
es gehört zur Geschichte des Fahrzeugs. Es sperrt. **Fotos** bleiben eigene
Teile — sie zeigen das Fahrzeug, sie dokumentieren nichts, was geschehen ist.

Auf Ebene der Datenbank ändert das nichts: seit M-38 sperrt ohnehin **jeder**
Fremdschlüssel. Der Unterschied liegt im Löschdienst, und er steht jetzt so in
T-012 und T-013.

### Was daraus wurde

| Was | Wo |
| --- | --- |
| Belegkette: Stände, gültig ist der letzte | M-41, `documents.chain_id` |
| Schnappschuss der Verweise beim Ausstellen | M-42, `document_snapshots` |
| Verbleib und Halterwechsel lückenlos | M-43, `vehicle_sales.exit_kind` |
| Muster und ihre Abgrenzung | [03-architektur.md](../03-architektur.md) §7.4 |
