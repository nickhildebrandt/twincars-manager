---
title: Datum, Geld und Dateien
kategorie: ui
status: umgesetzt
updated: 2026-09-13
---

# Datum, Geld und Dateien

Drei Felder, an denen sich Fehler in Tagen, in Cent und in Megabyte messen
lassen.

Zurück zum [Komponentenkatalog](README.md).

## DateField

Nach außen eine Zeichenkette `YYYY-MM-DD`, wie sie in der Datenbank steht.
Nach innen das Datumsobjekt, das Nuxt UI erwartet. Die Umrechnung läuft
**ohne** `Date`.

Wer ein `Date` dazwischenschaltet, verliert um Mitternacht UTC einen Tag — in
Europe/Berlin heißt das, jeder Tag zwischen 00:00 und 02:00 rutscht auf den
Vortag. Genau daraus entstehen Rechnungen mit falschem Leistungsdatum (B-028).
Die Rechnung steht in `shared/calendar-date.ts` und ist dort für jeden Tag
eines Jahres durchgerechnet.

Die Schreibweise kommt aus `UApp :locale="de"`: Tag vor Monat, Punkt als
Trenner. `01/03/2026` und `01.03.2026` bezeichnen zwei verschiedene Tage — die
Reihenfolge ist keine Geschmacksfrage. Eine bekannte Grenze: die
`aria-label`-Werte der einzelnen Segmente bleiben englisch, siehe
[blocker.md](../rewrite/blocker.md) W-02.

## MoneyField

Nach außen **ganze Cent**, wie überall in der Anwendung (E-10). Nach innen das,
was jemand tippt: `1.234,56`, `1234,56`, `1234.56`.

Umgerechnet wird erst beim Verlassen des Feldes oder auf die Eingabetaste —
sonst springt die Eingabe unter den Fingern: aus „12" würde „12,00", und die
nächste Ziffer landete hinter dem Komma.

Was sich nicht lesen lässt, **bleibt stehen** und wird als Fehler gemeldet:
„Bitte einen Betrag wie 1.234,56 eingeben." Es wird nicht still zu einer Null.
Ein leeres Feld ergibt `null`, nicht `0` — kein Betrag und ein Betrag von null
sind zwei verschiedene Aussagen.

## FileDropzone

Ablegen oder auswählen, mit **einer** Liste erlaubter Arten für beides. Beim
Vorgänger prüfte das Ablegen nur auf „irgendein Bild" und ließ Formate durch,
die der Dialog gar nicht anbot (B-115).

Jede abgewiesene Datei wird **einzeln gemeldet**, mit Namen. Beim Vorgänger
verschwand der Fehler in einem leeren `catch`, und wer eine zu große Datei
ablegte, sah gar nichts (B-100).

Grenzen und erlaubte Arten stehen in `shared/schemas/upload.ts` und gelten für
Oberfläche und Server gemeinsam; der Server prüft zusätzlich die ersten Bytes
der Datei, weil der vom Browser gemeldete Typ ein Hinweis ist und kein Beweis.

## Testselektoren

`date-<name>` · `money-<name>` · `dropzone`, `dropzone-browse`,
`dropzone-input`.

## Geprüft wird das so

`test/nuxt/form-fields.test.ts` und `test/nuxt/display-components.test.ts`;
die Rechnungen dahinter in `test/unit/calendar-date.test.ts` und
`test/unit/money.test.ts`.
