# 09 — „Zurückgehen" im Zeitstrahl: nur lesen oder wiederherstellen?

**Betrifft:** M-41, M-02, M-45, T-009, T-021 · **Stand:** **entschieden am
20.09.2026** — und weit über die Frage hinaus

## Worum es geht

Ihre Festlegung vom 20.09.2026:

> „In einer Zeitstrahlansicht muss man zurückgehen können. Die früheren Stände
> werden aus Dokumentationsgründen behalten."

„Zurückgehen können" lässt zwei Lesarten zu, und sie führen zu verschiedenen
Oberflächen.

## Die beiden Lesarten

**A — Nachschlagen.** Man öffnet einen früheren Stand und **liest** ihn: die
Positionen von damals, die Summen von damals, das PDF von damals. Bearbeiten
geht nicht. Der gültige Stand bleibt der gültige.

**B — Wiederherstellen.** Man öffnet einen früheren Stand und sagt „diesen
wieder". Die Anwendung legt daraus einen **neuen** Stand an — Version 4 mit
dem Inhalt von Version 2. Nichts wird überschrieben; die Kette wird länger.

Wichtig: B *ersetzt* A nicht, B *kommt zu* A dazu. Und B löscht nichts — auch
der zurückgenommene Stand bleibt stehen.

## Wann B gebraucht wird

Der Fall ist real: drei Runden Kostenvoranschlag, der Kunde sagt „eigentlich
war der zweite gut". Ohne B tippt jemand die Positionen des zweiten Standes
von Hand ab — und vertippt sich.

Der Fall ist bei **Rechnungen** heikler. Dort hieße B: storniere die aktuelle
und stelle eine neue mit dem alten Inhalt aus. Das ist zulässig, aber es ist
ein buchhalterischer Vorgang mit zwei neuen Belegen — kein „Rückgängig".

## Was heute umgesetzt ist

**A.** Ein früherer Stand lässt sich öffnen und lesen. Die Datenbank erlaubt B
ohne Weiteres; es fehlt nur die Bedienung dafür.

## Was ich empfehle

**A für beide Belegarten, B zusätzlich nur für den Kostenvoranschlag** — dort
als Schaltfläche „Diesen Stand wieder aufnehmen", die einen neuen Stand
erzeugt und im Zeitstrahl als solchen ausweist („übernimmt Stand 2").

Bei der Rechnung würde ich B **nicht** anbieten. Nicht weil es nicht ginge,
sondern weil es sich wie ein Rückgängig anfühlt und keines ist: am Ende stehen
zwei zusätzliche Belege in der Buchhaltung. Wer das will, soll Storno und
Neuausstellung ausdrücklich auswählen und dabei sehen, was entsteht.


---

## Entschieden am 20.09.2026 — und zum Werkzeug ausgebaut

> „Rechnung: nur lesen. Sobald eine neue Version einer Rechnung erstellt wird,
> ist die alte hinfällig. Kundendaten, Kfz-Daten und Kostenvoranschläge: aus
> dem Zeitstrahl heraus muss ein früherer Stand wiederhergestellt werden
> können. Beim Wiederherstellen wird der alte Stand als neue, aktuelle Version
> obendraufgesetzt; der Zeitstrahl bleibt lückenlos. Zusätzlich: Prüfe, wo
> sich dieses Prinzip noch sinnvoll anwenden lässt. Ziel ist ein
> wiederverwendbares Feature für Versionierung mit Zeitstrahl und
> gegebenenfalls Rücksprung, keine Einzellösung.“

Damit ist die Frage größer beantwortet, als sie gestellt war: aus **A oder B**
wurde **A für die Rechnung, B für alles andere — und B als Werkzeug**.

**Was daraufhin entstand** (M-45): `record_versions` plus
`server/services/record-version-service.ts`. Der Dienst weiß nichts über
Kunden oder Fahrzeuge; er kennt `entity`, `entityId` und einen Zustand. Einen
weiteren Datensatz zu versionieren heißt eine Zeile in `versionedEntities` und
ein Aufruf im Speicherpfad.

**Wo das Prinzip noch trägt** — die Prüfung, um die Sie gebeten haben:

| Datensatz | Warum | Auf der Liste |
| --- | --- | --- |
| Kunde, Fahrzeug | ausdrücklich gefordert | ja |
| Artikel, Reifen | Preise und Bezeichnungen ändern sich, Vertipper auch | ja |
| **Firmeneinstellungen** | wer sie zerschießt, merkt es an der nächsten Rechnung | ja |
| **E-Mail-Vorlagen** | der unterschätzte Fall: niemand sichert eine Vorlage vorher | ja |
| Belege | haben ihre **Kette** (M-41) — Nummern und buchhalterische Bedeutung | nein, anderes Werkzeug |
| Protokoll, Schnappschüsse | sind selbst Beweis und werden nie geändert | nein |
| Buchungen, Zahlungen | Geldvorgänge; Korrektur läuft über Gegenbuchung | nein |

**Eine Zusage, die im Code steht und nicht nur in der Absicht**: ein Rücksprung
löscht nichts (P-29). Der alte Stand wird obendraufgesetzt, der Zeitstrahl
wird länger, und der zurückgenommene Stand bleibt darin. Ein Test prüft genau
das.
