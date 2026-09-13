---
title: Die Anwendungshülle
kategorie: ui
status: umgesetzt
updated: 2026-09-13
---

# Die Anwendungshülle

Seitenleiste links, Kopfzeile oben, Inhalt rechts. Auf schmalen Geräten wird
die Leiste zur Schublade.

Zurück zum [Komponentenkatalog](README.md) ·
[Oberfläche](../architecture/oberflaeche.md)

## Die Teile

| Datei                                   | Zweck                                           |
| --------------------------------------- | ----------------------------------------------- |
| `app/layouts/default.vue`               | die Hülle; jede Seite der Anwendung liegt darin |
| `app/layouts/blank.vue`                 | ohne Hülle, für Anmeldung und Ersteinrichtung   |
| `app/components/app/AppSidebar.vue`     | Leiste mit Logo, Navigation, Version            |
| `app/components/app/AppHeader.vue`      | Seitentitel, Benutzermenü, Griff zur Schublade  |
| `app/components/app/AppUserMenu.vue`    | wer angemeldet ist, und der Weg hinaus          |
| `app/components/app/NavigationTree.vue` | die Einträge — einmal für Leiste und Schublade  |

`NavigationTree` ist eine eigene Komponente, weil der Vorgänger die Leiste am
Rand und die Schublade getrennt pflegte. Zwei Fassungen derselben Liste laufen
auseinander.

## Navigation

Acht Gruppen, Reihenfolge und Beschriftungen wie im Vorgängersystem. Die Liste
steht in `shared/navigation.ts` — dort, weil sie auch prüfbar sein muss.

**Gefiltert wird nach Modulen, nicht nach einzelnen Schlüsseln.** Ein Eintrag
darf mehrere Module nennen; eines genügt. Das behebt zwei Befunde:

- „Stunden" verlangte genau `hours:write_own`; eine Rolle mit vollem Zugriff
  verlor den Eintrag (B-058).
- „Gesendet" stand nur unter `invoices`, obwohl die Historie auch Angebote,
  Erinnerungen und Rundschreiben zeigt (B-375).

Eine Gruppe, deren Einträge alle wegfallen, verschwindet mit. Wer gar kein
Modul hat, behält „Start" — eine leere Leiste wäre eine Sackgasse.

**Markiert wird der längste passende Eintrag**, nicht jeder passende. Auf
`/settings/inquiries` war beim Vorgänger gleichzeitig „Einstellungen" und
„Anfragen" hervorgehoben (B-043).

## Ladeanzeige — drei Stufen

| Stufe | Auslöser              | Anzeige                                         |
| ----- | --------------------- | ----------------------------------------------- |
| 1     | jede laufende Anfrage | dünner Balken oben — die **einzige** Ladeleiste |
| 2     | angeklickte Aktion    | der Knopf zeigt einen Spinner und ist gesperrt  |
| 3     | Anfrage über 250 ms   | Sperrfläche über dem Inhalt, `aria-busy`        |

Die Leiste ist die von Nuxt; `useBusy()` steuert sie über
`useLoadingIndicator()`. Eine zweite anzulegen ist ein Regelverstoß, keine
Geschmacksfrage. Lokale `busy`-Flags in einzelnen Seiten gibt es nicht.

Stufe 3 liegt **über dem Inhaltsbereich**, nicht über der ganzen Seite:
Navigation und Kopfzeile bleiben bedienbar. Der Balken liegt absolut und
belegt keinen Platz im Fluss — sonst spränge die Seite bei jeder Anfrage um
zwei Pixel. Ein Browsertest misst das nach.

## Ungespeicherte Änderungen

`useFormDirty()` hält einen Zustand für die ganze Anwendung, kein Formular
seinen eigenen. Eine Seite hängt den Wächter mit `guard()` an; beim Speichern
ruft sie `markSaved()` **vor** dem Weiterleiten.

Der Wächter antwortet nur mit ja oder nein. Er ruft weder eine neue Navigation
noch `history.back()` auf — beim Vorgänger entstand dadurch nach „Verwerfen"
ein zusätzlicher Vorwärtseintrag im Verlauf, statt zurückzugehen (B-038).

## Die Schublade

Sie schließt sich nach jeder Navigation und bei jedem Klick auf einen Eintrag.
Beim Vorgänger hielt eine Checkbox den Zustand, die niemand zurücksetzte;
jeder Wechsel auf dem Telefon kostete einen zusätzlichen Tipp (B-019).

## Zugänglichkeit

- Die Navigation trägt `aria-label="Hauptnavigation"`, der aktive Eintrag
  `aria-current="page"`.
- Der Inhaltsbereich meldet `aria-busy`, während Stufe 3 läuft.
- **Fehler unterbrechen den Screenreader, Bestätigungen nicht.** Der Vorgänger
  las alles höflich vor, auch Fehler; wer nicht auf den Bildschirm sieht,
  erfuhr vom fehlgeschlagenen Speichern erst irgendwann (B-035).
- Der Griff zur Schublade heißt „Navigation öffnen".

## Kein Bild als Logo

Die Leiste zeigt ein Symbol aus der Icon-Sammlung und einen Schriftzug. Der
Vorgänger benutzte ein 1,1 MB großes PNG gleichzeitig als Favicon und als 38
Pixel kleines Logo — über Mobilfunk bei jedem ersten Aufruf bezahlt (B-017).

## Geprüft wird das so

`test/nuxt/app-shell.test.ts` prüft Sichtbarkeit, Gruppen, aktive Markierung,
Schublade und Ladeanzeige. `test/unit/navigation.test.ts` prüft die Liste
selbst, samt der Zusage, dass jedes Symbol in der Sammlung existiert.
`test/browser/motion.test.ts` misst, dass die Ladeanzeige nichts verschiebt.
