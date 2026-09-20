# 07 — Was „null Verweise" für die eigenen Teile eines Datensatzes heißt

**Betrifft:** M-38, T-011, T-012, T-022 · **Stand:** offen, so umgesetzt

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
