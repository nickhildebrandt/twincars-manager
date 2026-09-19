---
title: Protokoll und Absicherung
kategorie: architecture
status: umgesetzt
updated: 2026-09-17
---

# Protokoll und Absicherung

Wer hat wann von wo woran was gemacht — und was davon war sicherheitsrelevant.

Zurück zur [Übersicht](../index.md).

## Ein Protokoll, nicht zwei

Die gewöhnliche Änderung an einem Datensatz und das Sicherheitsereignis stehen
in **derselben** Tabelle (`audit_log`, M-01 und M-39). Wer wissen will, was am
Dienstagnachmittag geschah, soll an einer Stelle nachsehen. Unterschieden wird
durch ein **Gewicht**:

| Gewicht      | Wofür                                                   | In der Oberfläche            |
| ------------ | ------------------------------------------------------- | ---------------------------- |
| `info`       | die gewöhnliche Änderung                                | normal                       |
| `warnung`    | Storno, Löschung, Archivierung, Import, Rückspielung    | hervorgehoben                |
| `sicherheit` | Anmeldung, Sperre, abgewiesener Zugriff, Rechte, Export | **deutlich, eigener Filter** |

Jeder Eintrag beantwortet fünf Fragen: **wann**, **wer** (Kennung und
eingefrorener Name), **von welcher Adresse**, **woran**, **was**. Bei einer
Änderung dazu die geänderten Felder mit altem und neuem Wert.

## Ein Eintrag je Speichervorgang

```ts
await recordChange(
  {
    entity: 'customers',
    entityId: customer.id,
    action: 'geaendert',
    before: vorher,
    after: nachher
  },
  event
)
```

`changesBetween` vergleicht die beiden Zustände und schreibt **einen** Eintrag
mit den geänderten Feldern (P-17). Nicht einen je Feld: „am 4. März hat Anna
die Anschrift und die Telefonnummer geändert" ist eine Auskunft, zwei Zeilen
mit derselben Sekunde sind es nicht.

**Unveränderte Felder stehen nicht drin** — sonst ersäuft der eine geänderte
Wert in vierzig gleichen. Ein Speichern ohne Änderung erzeugt gar keinen
Eintrag.

`null`, `undefined` und ein fehlendes Feld gelten als dasselbe. Ein Formular
schickt mal das eine, mal das andere; für einen Menschen steht da in allen drei
Fällen nichts.

## Was nie hineingerät

Felder, deren Name auf ein Geheimnis hindeutet — `password`, `hash`, `salt`,
`token`, `secret`, `privateKey` und alles, was diese Wörter enthält — werden
**nie** protokolliert. Geprüft wird auf Teilzeichenketten, damit auch
`smtpPassword` und `ebayAccessToken` erwischt werden. Lieber ein Feld zu viel
ausgelassen als eines zu wenig: ein Protokoll, das Passwörter mitschreibt, ist
selbst das Leck.

Die Prüfung greift auch dann, wenn ein Aufrufer ein solches Feld ausdrücklich
hineinreicht.

## Der abgewiesene Zugriff

Ein **403** ist der interessanteste Eintrag, den es gibt: jemand war angemeldet
und hat etwas versucht, das er nicht darf. Er wird zentral im Fehler-Haken
protokolliert (`server/plugins/10.error.ts`) — dort kommt **jeder** 403 vorbei,
egal aus welchem Wächter er stammt (P-18).

Ein **401** wird bewusst nicht protokolliert. Das ist im Alltag eine abgelaufene
Sitzung, und jede offene Registerkarte erzeugte dann mehrere Einträge. Die
Anmeldung führt ihr eigenes Protokoll.

## Nie ändern

Das Protokoll wird geschrieben und gelesen, **nie geändert** (P-19). Ein
Protokoll, das sich bearbeiten lässt, ist kein Beweis. In `server/utils/audit.ts`
gibt es kein `update` und kein `delete`; ein Querschnittstest prüft, dass auch
kein anderer Dienst im Server das tut.

Die einzige Ausnahme ist die Rotation — und die löscht nur **ganze Einträge nach
Alter**, sie ändert keinen und schneidet keinen zurecht.

## Rotation

Ein Protokoll, das nie aufräumt, wächst bis zur Unbrauchbarkeit; eines, das zu
früh aufräumt, ist im Ernstfall leer. Also drei Fristen nach dem, worum es geht
(P-20):

| Was                                            | Aufbewahrung |
| ---------------------------------------------- | ------------ |
| Buchhaltungsnahes (Beleg, Zahlung, Buchung, …) | **10 Jahre** |
| Gewicht `sicherheit`                           | **2 Jahre**  |
| Alles andere                                   | **1 Jahr**   |
| Anmeldeversuche (`sign_in_attempts`)           | **90 Tage**  |

**Die längste Frist gewinnt:** ein Sicherheitsereignis an einem Beleg bleibt
zehn Jahre, nicht zwei.

Die Anmeldeversuche sind ein **Zähler**, kein Archiv — die längste Frist, die
sie liest, ist ein Tag (P-13). Was darin steht, steht als Ereignis ohnehin im
großen Protokoll.

Die Rotation läuft nachts um 03:10 als Nitro-Aufgabe, ist wiederholbar (ein
zweiter Lauf löscht nichts mehr) und **protokolliert selbst**, was sie entfernt
hat. Sonst wäre ausgerechnet die Aufgabe, die Spuren beseitigt, die einzige
ohne Spur.

## Protokollieren hält nichts auf

Scheitert das Schreiben, scheitert **nicht** der Vorgang — der Fehler landet im
Serverlog. Ein volles oder kaputtes Protokoll darf niemanden an der Arbeit
hindern. Dasselbe gilt für das Anmeldeprotokoll und für die Sperre.

## Die Sicherheits-Kopfzeilen

Jede Antwort trägt sie, auch die abgewiesene (M-40, P-21). Das Zwischenstück
steht deshalb an **erster** Stelle: hinter dem Wächter käme eine 401-Antwort
ohne jede Richtlinie heraus.

| Kopfzeile                                         | Wofür                                        |
| ------------------------------------------------- | -------------------------------------------- |
| `Content-Security-Policy`                         | woher Skripte, Stile, Bilder kommen dürfen   |
| `Strict-Transport-Security`                       | nur über HTTPS — **nur gesetzt, wenn https** |
| `X-Content-Type-Options: nosniff`                 | kein Raten des Inhaltstyps                   |
| `X-Frame-Options: DENY` · `frame-ancestors`       | kein Einbetten in eine fremde Seite          |
| `Referrer-Policy: same-origin`                    | keine interne Adresse nach draußen           |
| `Permissions-Policy`                              | Kamera, Mikrofon, Standort, Zahlungen aus    |
| `Cross-Origin-Opener-Policy` · `-Resource-Policy` | kein Zugriff aus einem fremden Fenster       |
| `X-Robots-Tag: noindex`                           | gehört in keinen Suchindex                   |

**HSTS nur über HTTPS.** Über http gesetzt sperrt diese Zeile den Browser für
zwei Jahre aus der eigenen Anwendung aus, und zwar so, dass es niemand ohne
Handarbeit im Browserprofil wieder löst.

### Der Einmalwert für die Skripte

Eine gerenderte Seite trägt vier eingebettete `<script>`: die Importkarte, das
Modul des Einstiegspunkts, das Farbschema-Skript von Nuxt UI und den
Seitenzustand. Drei davon werden ausgeführt; `script-src 'self'` allein
verbietet sie, und die Seite hydriert nicht.

Statt `'unsafe-inline'` — das **jedes** eingebettete Skript erlaubt, auch ein
eingeschleustes — bekommt jede Antwort einen **Einmalwert**: 16 zufällige
Bytes, gewürfelt im Kopfzeilen-Zwischenstück, eingetragen in
`script-src 'nonce-…'`, und über den Nuxt-Haken `render:html` an jedes Skript
des Rahmens geschrieben.

**`body` wird dabei ausdrücklich nicht gestempelt.** Dort steht der gerenderte
Seiteninhalt. Ein `<script>`, das über eine Lücke dort hineingeriete, bekäme
durch den Stempel genau die Erlaubnis, die ihm die Richtlinie verweigern soll —
die Maßnahme höbe sich selbst auf. Gestempelt wird nur, was der Rahmen selbst
erzeugt (`FRAMEWORK_PARTS`), und ein Test hält fest, dass `body` nicht dazu
gehört.

Im **Entwicklungsbetrieb** bleibt `'unsafe-inline'`: dort fügt Vite eigene
Skripte ein, die nicht durch den Haken laufen. Der Betrieb ist der Ernstfall.

Bei den **Stilen** bleibt `'unsafe-inline'` — warum, steht in
[offene-fragen/02](../rewrite/offene-fragen/02-stile-unsafe-inline.md).

## Geprüft wird das so

| Ebene       | Datei                                      | Was                                                     |
| ----------- | ------------------------------------------ | ------------------------------------------------------- |
| Integration | `test/integration/protokoll.test.ts`       | ein Eintrag je Vorgang, Geheimnisse, Rotation, Fristen  |
| Integration | `test/integration/auth-middleware.test.ts` | Kopfzeilen auf jeder Antwort, auch der abgewiesenen     |
| Einheit     | `test/unit/security-headers.test.ts`       | die Richtlinie, HSTS nur über https                     |
| E2E         | `test/e2e/ssr.test.ts`                     | die Kopfzeilen am echten Build, Seite hydriert trotzdem |
