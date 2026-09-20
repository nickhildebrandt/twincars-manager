# 06 — Wie soll die Protokollansicht aussehen?

**Betrifft:** M-39, T-034 · **Stand:** **entschieden am 20.09.2026**

## Worum es geht

Das Protokoll schreibt seit dem 17.09.2026 mit: jede Änderung an einem
Datensatz mit altem und neuem Wert, jede Anmeldung, jede Sperre, jeder
abgewiesene Zugriff. Was fehlt, ist die Ansicht dafür.

Sie hatten gesagt, Sicherheitsereignisse sollen „nochmal extrem hervorgehoben"
werden. Bevor ich das baue, drei Fragen.

## Frage 1 — Wo lebt die Ansicht?

**A — unter Einstellungen**, zusammen mit Benutzern und Rollen. Naheliegend:
wer das Protokoll liest, verwaltet auch.

**B — ein eigener Menüpunkt** „Protokoll", sichtbar nur mit dem Recht
`settings`. Sichtbarer, aber ein weiterer Eintrag in der Seitenleiste.

## Frage 2 — Was steht auf der Startansicht?

**A — alles, neueste zuerst**, mit Filter nach Gewicht, Person, Zeitraum und
Datensatz. Sicherheitsereignisse farblich abgesetzt.

**B — zwei Bereiche**: oben „Sicherheit" (die letzten Ereignisse mit Gewicht
`sicherheit`), darunter alles Übrige. Das Wichtige sieht man ohne zu filtern.

**C — eine Kachel auf dem Dashboard**, die zählt, was seit gestern an
Sicherheitsereignissen dazugekommen ist, und ins Protokoll führt.

B und C schließen sich nicht aus.

## Frage 3 — Soll etwas aktiv melden?

Bisher meldet sich nur die **dauerhafte Kontosperre** und die
**Adresssperre** per E-Mail (P-16, kommt mit T-026). Denkbar wären außerdem:

- eine Häufung abgewiesener Zugriffe (jemand klickt sich durch Bereiche, die
  er nicht darf);
- eine Anmeldung außerhalb der Öffnungszeiten;
- eine Änderung an Rollen und Rechten.

Jede Meldung, die zu oft kommt, wird ignoriert — das ist die eigentliche
Gefahr. Deshalb lieber zwei Anlässe, die wirklich etwas bedeuten, als zehn.

## Empfehlung

Frage 1: **A**. Frage 2: **B plus C**. Frage 3: zusätzlich nur **Änderungen an
Rollen und Rechten** — alles andere sammelt sich im Protokoll und wird beim
Nachsehen gefunden.


---

## Entschieden am 20.09.2026

**Ort.** Eigener Menüpunkt, sichtbar nur für Administratoren. Nicht als Reiter
in den Einstellungen. Das Protokoll rotiert sich selbst. Bei besonders
schweren Vorgängen trägt der Menüpunkt einen Zähler mit der Anzahl der
Probleme.

**Aufbau.** Eine Liste, chronologisch, mit Filter nach Sicherheit und allen
weiteren Kategorien. Zusätzlich eine Kachel auf dem Dashboard.

**Umfang.** Sicherheit ist nicht auf die Anmeldung beschränkt: auch komplexe
Vorgänge, Fehler und verheerende Vorgänge werden erfasst und über das Gewicht
eingeordnet.

**E-Mail.** Bei gravierenden Vorfällen geht automatisch eine Nachricht an die
Administrator-Adresse. Genannt wurden: große gelöschte Datenmengen, blockierte
Adressen, eine geplante Sicherung, die nicht durchlief, fehlgeschlagene
Hintergrundläufe, viele Fehler. Was als gravierend gilt, entscheide ich.

**Was daraus wurde.** Der Abschnitt in T-034 des Arbeitsplans. Die
Administrator-Adresse hat eine eigene Spalte bekommen
(`company_settings.admin_email`) — getrennt von der Geschäftsadresse, die auf
jeder Rechnung steht.
