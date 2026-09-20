# 09 — „Zurückgehen" im Zeitstrahl: nur lesen oder wiederherstellen?

**Betrifft:** M-41, M-02, T-021 · **Stand:** offen, vorläufig als „nur lesen"
umgesetzt

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
