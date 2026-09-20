# 03 — Das Datumsfeld spricht für Screenreader englisch

**Betrifft:** W-02, T-009 · **Stand:** **entschieden am 20.09.2026** — bleibt so

## Worum es geht

Das Datumsfeld besteht aus drei Segmenten (Tag, Monat, Jahr). **Reihenfolge und
Trenner stimmen** — `01.03.2026`, deutsch, mit Punkt. Das ist der Teil, an dem
ein Fehler Daten verfälscht, und er ist durch einen Test festgenagelt.

Die `aria-label`-Werte der Segmente bleiben aber englisch: `day,`, `month,`,
`year,` — und ein Monat wird als `1 - January` vorgelesen.

## Warum es nicht behoben ist

Reka UI erzeugt diese Beschriftungen im Inneren der Komponente. Es gibt keine
Eigenschaft dafür und keinen Haken. Die Auswege wären, nach dem Rendern im DOM
herumzuschreiben oder das Feld nachzubauen — und ein nachgebautes Datumsfeld
verliert Tastaturbedienung, Fokusführung und Zeitzonenfestigkeit, also genau
das, wofür die Komponente da ist.

## Wen es trifft

Nur jemanden, der die Anwendung mit einer Vorlesehilfe bedient. Im Betrieb
derzeit niemanden — aber es ist ein Mangel, und er steht hier, damit er nicht
in Vergessenheit gerät.

## Was zur Wahl steht

**A — abwarten**, bis Reka UI die Beschriftungen aus der Sprachdatei nimmt.
Dann ist es eine Zeile.

**B — das Feld nachbauen.** Hoher Aufwand, hohes Risiko, schlechteres Ergebnis
in allem anderen.

**C — ein eigenes Textfeld** `TT.MM.JJJJ` mit Maske statt der Segmente.
Verliert den Kalender und die Pfeiltasten-Bedienung.

## Empfehlung

**A.** Der Mangel ist real, aber klein, und jede Behebung kostet mehr, als sie
bringt.


---

## Entschieden am 20.09.2026 — bleibt, und eine Regel dazu

Die englischen Segmentbeschriftungen bleiben. Dazu eine allgemeine Vorgabe,
die über diese Frage hinausgeht:

> „Das Projekt muss so aufgesetzt sein, wie es bei Nuxt dokumentiert ist bzw.
> wie es das Nuxt-Aufsetzungsskript macht. Neueste stabile Version des
> Frameworks. Normale Abhängigkeitspakete sind in Ordnung, aber keine
> zufälligen Pakete, die für das Framework nicht geeignet sind, und keine
> Versionsmismatches, wie sie bei Handinstallation entstehen. Ziel: zukünftig
> ohne große Probleme updatebar."

Das heißt für diese Frage: **kein** Ausweichpaket für ein Datumsfeld, **kein**
Nachbau, **kein** Eingriff in die Auslieferung von Reka UI. Die Beschriftung
wird englisch bleiben, bis das Paket sie übersetzt.

Die Vorgabe selbst ist als [E-24](../08-entscheidungen.md) festgehalten.
