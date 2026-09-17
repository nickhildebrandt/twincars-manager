# Änderungen am Daten- und Prozessmodell

**Stand:** 13.09.2026 · **Grundlage:** die Datenmodell-Übersicht nach T-008
(51 Entitäten, 61 Beziehungen, 7 Bereiche) · **Verbindlich**

Der Betriebsinhaber ist die Übersicht durchgegangen und hat festgelegt, was am
Modell geändert, ergänzt und gestrichen wird. Dieses Dokument ist die Quelle
für alles, was daraus folgt. Wo es einer früheren Festlegung widerspricht,
gewinnt dieses Dokument.

Jede Änderung trägt eine Kennung `M-nn`. Jede Prüfregel, die sich **nicht** aus
dem Datenmodell ergibt und deshalb ausdrücklich programmiert und getestet
werden muss, trägt `P-nn`. Beide werden wie Befunde nachgehalten:
`pnpm test:modell` verlangt zu jeder Kennung einen Test, dessen Name mit ihr
beginnt.

**Fachlicher Rahmen:** kleine Kfz-Werkstatt im Familienbetrieb, mit
Werkstattservice, Fahrzeughandel und Reifenhandel (auch über eBay). Alles läuft
im Haus per WLAN; ein Cloud-Hosting bleibt offen.

Die technischen Rahmenbedingungen aus [03-architektur.md](03-architektur.md)
gelten unverändert: Nuxt und Nuxt UI ohne eigenes CSS, Drizzle, Valibot an jeder
Grenze, pnpm, ESLint statt Prettier, semantic-release, Toast bei jeder Mutation,
serverseitige Pagination, Mehrfachauswahl im modalen Dialog, Tests über alle
Ebenen, Doku als verlinktes Wissensnetz.

---

## 1. Übergreifende Prinzipien

Diese vier wiegen schwerer als jede Einzelanforderung weiter unten.

### M-01 — Ein Ereignisprotokoll statt weiterer Versionstabellen

Ein zentrales Protokoll hält fest: **wer** hat **wann** an **welchem Datensatz**
**was** geändert, mit altem und neuem Wert. Daraus speist sich jede
Historie-Anzeige.

Es werden **keine weiteren feldbezogenen Versionstabellen** angelegt. Es bleiben
genau drei, und zwar die, bei denen ein Wert **ab einem Datum gilt** und das
Datum in der Zukunft liegen darf:

| bleibt | warum |
| --- | --- |
| Reifenpreis | gilt ab einem Datum, auch künftig |
| Artikelpreis | dito |
| Gehaltsstand | dito |

**Der Unterschied, auf den es ankommt.** Das Protokoll beantwortet „wer hat was
geändert" — Vergangenheit, Beweis. Die Version beantwortet „was gilt ab wann" —
auch Zukunft, fachliche Wahrheit. Preise werden bei **jeder** Belegposition
aktiv abgefragt; das darf nicht aus einem Änderungsprotokoll rückwärts
rekonstruiert werden.

### M-02 — Historie ist ein Zeitstrahl, keine Tabelle

Wo eine Historie existiert, wird sie grafisch als Zeitstrahl gezeigt.
Mindestens:

- **Fahrzeug:** Halterwechsel, Kennzeichen, Kilometerstand, HU-Termine
- **Beleg:** Statusverlauf (Kostenvoranschlag → Rechnung → versendet → bezahlt)
- **Auftrag:** Statusverlauf auf der Tafel
- **Mitarbeiter:** Gehaltsstände — nur im Personalmodul, siehe M-04
- **Reifen und Artikel:** Preisverläufe

Preis- und Lohnverläufe zusätzlich als Verlaufskurve mit wählbarem Zeitraum.

### M-03 — Ein ausgestellter Beleg friert ein

Alles, was auf einem ausgestellten Beleg steht, wird **beim Ausstellen
hineinkopiert** und ändert sich danach nie wieder. Der Beleg holt sich
nachträglich nichts von woanders:

- Firmendaten: Name, Anschrift, Steuernummer, Fußzeile
- Kundendaten: Name, Anschrift, bei Firmen die Steuernummer
- Positionsbezeichnungen, Preise, Steuersatz

Die Firmeneinstellung bleibt **eine** Zeile, die überschrieben wird — keine
Versionierung. Firmendaten ändern sich zu selten, um sie nachvollziehen zu
müssen; die Kopie im Beleg ist der Beweis und reicht.

Die **Kundenanschrift** ist der bisher fehlende Fall: zieht ein Kunde um, darf
sich seine Rechnung von 2019 nicht rückwirkend ändern.

### M-04 — Berechtigungen bleiben auf Modulebene

Keine feingranularen Rechte. Die Rollen bleiben grob (Administrator,
Werkstattleiter, Mitarbeiter), Rechte gelten je Modul.

**Was daraus zwingend folgt:** Lohn, Urlaubsanspruch, Wochenstunden und
Gehaltshistorie liegen **ausschließlich im Personalmodul**. Sie dürfen nicht in
einem Mitarbeiterprofil auftauchen, das der Werkstattleiter zum Zuweisen öffnet
— sonst sickern sie über die Hintertür durch.

---

## 2. Kunden & Fahrzeuge

### M-05 — Das Fahrzeug überlebt den Kunden

**Heute** hängt das Fahrzeug am Halter mit „geht mit": den Kunden löschen löscht
das Auto. Gleichzeitig ist der **Vorbesitzer** als „Verweis entfällt"
modelliert. Dieselbe Art Beziehung, zwei verschiedene Regeln.

Der Halter-Verweis wird zu **„sperrt"** (bevorzugt), ersatzweise „Verweis
entfällt". Ein Fahrzeug ohne Halter ist kein Datenfehler.

**Neues Statusfeld am Fahrzeug**, mit drei Werten:

| Wert | Bedeutung |
| --- | --- |
| `kundenfahrzeug` | gehört einem Halter |
| `bestand` | steht zum Verkauf |
| `verkauft` | gehört einem neuen Halter |

In allen drei Fällen bleiben die Fahrzeugdaten vollständig erhalten.

**Folge für E-11:** die dort beschlossene Kaskade vom Kunden auf das Fahrzeug
entfällt. Der Rest von E-11 gilt weiter.

**Was beim Löschen eines Fahrzeugs geschieht**, steht seit dem 17.09.2026 nicht
mehr hier, sondern in **M-38** — es gilt für jeden Datensatz gleich und nicht
nur für Fahrzeuge.

### M-06 — Halter-Historie

Neue Historie neben der Kennzeichen-Historie: **welcher Kunde war wann Halter**.
Darstellung im Zeitstrahl des Fahrzeugs (M-02).

### M-07 — eBay-Käufer bleiben Kunden

eBay-Käufer werden **nicht** in eine eigene Tabelle abgespalten. Sie brauchen
eine Rechnung, und die hängt am Kunden; zwei Kundentabellen hießen zwei
Rechnungswege.

Die Kundenart steuert stattdessen die Oberfläche:

- Beim eBay-Käufer nur die passenden Felder: Name, Lieferanschrift,
  eBay-Benutzername, E-Mail. Keine Fahrzeug-Reiter, keine
  Reifenservice-Kacheln.
- In der Kundenliste sind eBay-Käufer **standardmäßig ausgeblendet** — sonst
  ersaufen ein paar hundert Werkstattkunden in tausenden eBay-Käufern.

Die drei Kundenarten aus E-16 bleiben: privat, firma, ebay.

---

## 3. Werkstatt & Aufträge

### M-08 — Der doppelte Verweis Auftrag ↔ Beleg wird aufgelöst

**Heute** zeigt der Auftrag auf die Rechnung *und* der Beleg zurück auf den
Auftrag. Zwei Verweise für eine Verbindung, die auseinanderlaufen können.

Es bleibt **eine** Richtung: **der Beleg zeigt auf den Auftrag.** Der Verweis
`work_orders.invoice_id` wird gestrichen.

### M-09 — Belegregeln je Auftrag

- Ein Auftrag kann **mehrere Kostenvoranschläge** haben. Der neueste gilt; aus
  ihm entsteht die Rechnung.
- Ein Auftrag hat **genau eine gültige Rechnung**.
- Eine stornierte Rechnung **bleibt am Auftrag hängen**. Sie verschwindet
  nicht, die Nummer ist vergeben. Bei der Regel „genau eine gültige" zählt sie
  nicht mit.

Die Rechnung eines Auftrags wird über die Beleg-Beziehung gefunden, gefiltert
auf Belegart Rechnung und nicht storniert. Siehe **P-01**.

### M-10 — Der Zeiteintrag wird gestrichen

Die Tabelle `time_entries` entfällt **vollständig**. Sie trug fünf Verweise
(Kunde, Beleg, Mitarbeiter, Auftrag, Auftragsposition), drei davon redundant.

**Warum:** Es wird **kein Controlling der Arbeitszeit** betrieben. Wie lange ein
Mitarbeiter braucht, wer was korrigiert hat, wie Innenzeiten aussehen — alles
nicht relevant. Erfasst wird ausschließlich, was dem Kunden berechnet wird.

Stattdessen:

- Die Zeit steht als Wert **an der Auftragsposition**. Das Büro kann sie ändern.
- Keine Trennung zwischen erfasster und abgerechneter Zeit.
- Keine Erfassung von Innenzeiten (aufräumen, überführen).

### M-11 — Mitarbeiter werden auf Positionsebene zugewiesen

**Heute** hängt die Auftragsposition an **genau einem** Mitarbeiter, und zwar
sperrend. Das geht nicht auf: an einem Auftrag und an einer Position arbeiten
mehrere.

Die Zuweisung (`work_order_assignees`) wird von der Auftrags- auf die
**Positionsebene** verlagert — mehrere Mitarbeiter je Position. Der sperrende
Einzelverweis `work_order_items.employee_id` entfällt.

### M-12 — Mitarbeiter werden deaktiviert, nicht gelöscht

**Heute** sperren Auftragsposition und Kalendereintrag den Mitarbeiter, während
Abwesenheit und Gehaltsstand mit ihm mitgingen. Ginge ein Löschen doch durch,
verschwänden aufbewahrungspflichtige Personaldaten ersatzlos.

Mitarbeiter werden **deaktiviert**. Gehaltsstände und Abwesenheiten bleiben in
jedem Fall erhalten.

### M-13 — Die Tafel dient der Übersicht, nicht der Zeitmessung

Zweck: sehen, **wer gerade woran arbeitet** und **wie viel Arbeit offen ist**.
Kein Zeitcontrolling.

**Mobile Erfassung:** Der Mitarbeiter erfasst am Telefon direkt auf die
**Auftragsposition**, nicht auf den Auftrag — die Position wird später zur
Rechnungszeile. Er legt beim Arbeiten selbst an, was verbaut wurde und wie lange
es dauerte. Die Positionen entstehen also **während der Arbeit**, nicht vorher
im Büro.

**Freitext ist für beide Seiten erlaubt**, Werkstatt wie Büro. Kein Zwang zur
Auswahl aus dem Katalog. Das Büro schaut hinterher drüber, justiert Zeiten und
Positionen und stellt die Rechnung.

Ziel: Die Arbeit im Büro entfällt, weil die Rechnung in der Werkstatt entsteht.

---

## 4. Belege & Zahlungen

### M-14 — Die Belegnummer wird beim Ausstellen gezogen, gesperrt

**Heute** zählt ein Zähler je Belegart ohne Sperre hoch. Zwei gleichzeitige
Zugriffe können dieselbe Rechnungsnummer zweimal vergeben. Bei Rechnungen ist
das ein echtes Problem: lückenlos und eindeutig sind gefordert.

- Die Nummer wird **erst beim endgültigen Ausstellen** gezogen, nicht beim
  Anlegen des Entwurfs.
- Bis dahin ist der Beleg ein Entwurf **ohne Nummer** und lässt sich löschen,
  ohne eine Lücke zu hinterlassen.
- Das Ziehen läuft in **einer Transaktion mit Zeilensperre** im Nummernkreis:
  sperren, hochzählen, vergeben — in einem Zug.

Siehe **P-02**.

### M-15 — Es gibt nur zwei Belegarten

**Kostenvoranschlag** und **Rechnung**. **Angebot und Auftragsbestätigung fallen
weg**, samt ihrer Felder. Der Beleg trägt heute 28 Felder für vier Arten; er
wird auf die zwei verbleibenden zugeschnitten.

**Zur Begrifflichkeit:** Das Angebot ist rechtlich verbindlich, der
Kostenvoranschlag eine unverbindliche Schätzung mit einer zulässigen
Überschreitung von etwa 15 %. In der Werkstatt ist immer der Kostenvoranschlag
gemeint.

**Beim Import** ist zu prüfen, ob das Altsystem beide Arten führte. Falls ja,
werden sie zu **Kostenvoranschlag** zusammengeführt (siehe M-29).

**Prüfregeln je Belegart:** Zahlungsziel, Mahnstufe und Storno gelten nur für
Rechnungen. Die Validierung ist je Belegart zu definieren, damit kein
Kostenvoranschlag mit Mahnstufe entstehen kann. Siehe **P-05**.

Der Kostenvoranschlag bekommt eine eigene Nummer, aber **keine
Lückenlosigkeit** — die ist nur bei Rechnungen gefordert.

### M-16 — Zahlarten und was ins Kassenbuch geht

Eine Zahlung am Beleg trägt eine **Zahlart: bar oder Karte**.

**Nur Barzahlungen** laufen ins Kassenbuch. Kartenzahlungen nicht — sonst
stimmt der Kassenbestand nicht mit der Kasse überein. Siehe **P-07**.

---

## 5. Reifen

Zwei getrennte Welten, die sich an genau einer Stelle berühren:

- **Reifenhandel:** Katalog, Preise, Fotos, eBay-Angebote. Hier wird verkauft.
- **Reifenservice:** Der Kunde hat Radsätze, die zum Fahrzeug gehören,
  gewechselt und eingelagert werden.

**Der Berührungspunkt:** Ein gekaufter Satz wird beim Verkauf zum Radsatz des
Kunden und lässt sich direkt einem Fahrzeug zuweisen. Ab da gehört er in die
Servicewelt und ist Katalog-Vergangenheit.

### M-17 — Der Radsatz ersetzt die Einlagerung

Die bisherige Reifeneinlagerung (`tire_storage`, am Kunden *und* am Fahrzeug,
ohne Verweis auf einen Reifen) wird zum **Radsatz am Fahrzeug**:

- gehört zum **Fahrzeug**, nicht zum Kunden
- Saison: Winter, Sommer, Allwetter — offen erweiterbar
- **Zustand: montiert oder eingelagert**, mit Lagerplatz und Profiltiefe
- je Fahrzeug **mehrere Radsätze**, davon **genau einer montiert** (**P-03**)
- Der Wechsel ist ein Tausch der Zustände zweier Sätze
- In der Oberfläche muss auf einen Blick sichtbar sein, welcher montiert ist

### M-18 — Reifenservice mit einem Klick

Fahrzeug aufrufen → Radsatz wählen → „wechseln". Das System

1. tauscht die Zustände der Radsätze,
2. legt einen Auftrag an,
3. setzt die Standardpositionen ein (Wechseln, Wuchten, ggf. Einlagerung),
4. lässt Ergänzungen zu,
5. führt zur Rechnung.

**Die Standardpositionen sind konfigurierbar**, nicht fest verdrahtet — als
Artikelverweise in den Firmeneinstellungen (M-22). Sonst muss bei jeder
Preisänderung der Entwickler ran.

### M-19 — Die Wechsel-Erinnerung hängt am Radsatz

Heute hängt sie am Kunden. Sie gehört an den **Radsatz** — dann ist auch klar,
welches Fahrzeug gemeint ist.

### M-20 — Ein aktives eBay-Angebot sperrt seinen Reifen

**Heute** „Verweis entfällt": ein Reifen lässt sich löschen, während sein
Angebot online steht.

Ein Reifen mit **aktivem** Angebot lässt sich nicht löschen. **Beendete**
Angebote dürfen verwaisen — das ist Historie. Siehe **P-04**.

---

## 6. Stammdaten & Personal

### M-21 — Durchlaufposten werden steuerlich getrennt

Der Artikel kennt vier Arten: Arbeitswert, Material, Durchlaufposten, Artikel.
Durchlaufende Posten sind **umsatzsteuerfrei** — etwa eine weitergereichte
TÜV-Gebühr.

Der Beleg muss diese Art kennen und sie **getrennt ausweisen**, sonst stimmt die
Umsatzsteuer nicht. Siehe **P-06**.

### M-22 — Standardartikel werden eine Liste

Die Firmeneinstellung verweist heute auf **einen** Standardartikel
(Arbeitszeit). Daraus wird eine kleine Liste:

- Standardartikel Arbeitszeit
- Standardartikel Reifenwechsel
- Standardartikel Wuchten
- Standardartikel Einlagerung

Damit hängt der Ein-Klick-Reifenservice (M-18) an konfigurierbaren Werten.

---

## 7. Buchhaltung / Kassenbuch

Grundlage ist die bisherige Excel-Führung: **eine Barkasse**, ein Blatt je
Monat, Spalten Buchungsnummer, Datum, Buchungstext, Betrag mit Vorzeichen,
laufender Saldo. Die Buchungsnummern laufen durch das Jahr; jeder Monat startet
mit dem Übertrag aus dem Vormonat.

### M-23 — Der Saldo wird gerechnet, nicht gespeichert

Der laufende Saldo ist **kein Feld**. Er wird immer aus den Buchungen gerechnet
— sonst läuft er auseinander, sobald jemand eine alte Buchung korrigiert.
Dasselbe gilt für die Monatsüberträge. Siehe **P-09**.

### M-24 — Erfasst wird von Hand, mit einer Erleichterung

Das Kassenbuch wird weiter **von Hand** geführt, keine Zwangsautomatik. Teile-
und Materialeinkäufe kommen per Mail oder auf Papier ins Haus und müssen
erfassbar sein.

**Die Erleichterung ohne Automatik:** Eingegangene **Barzahlungen** erscheinen
in einer Liste „noch nicht gebucht". Von dort wird mit einem Klick bestätigt
statt abgetippt; die Kategorie wählt der Nutzer selbst.

### M-25 — Jede Buchung nennt ihre Herkunft

Ein Merkmal je Buchung: **aus der Anwendung entstanden** oder **von Hand
erfasst**.

Hintergrund: Werkstattrechnungen, Fahrzeugverkäufe, Reifenverkäufe und
Gutschriften sind künftig ableitbar — im Referenzjahr rund **150 von 809**
Buchungen. Von Hand bleiben im Wesentlichen Zulieferereinkäufe und TÜV-Gebühren,
rund **630**.

### M-26 — Kategorien, mit eigenen für Fahrzeuge

Aus der Auswertung des Referenzjahres (809 Buchungen, 22 Präfixe):

| Präfix | Anzahl | Vorzeichen | Bedeutung |
| --- | --- | --- | --- |
| EK | 527 | immer negativ | Einkauf (Teile, Kraftstoff, Baumarkt, Supermarkt) |
| Tüv | 99 | immer negativ | TÜV-Gebühren |
| Rechnung | 75 | immer positiv | Werkstatterlös |
| Gutschrift | 39 | immer positiv | Gutschrift Lieferant |
| VK | 18 | immer positiv | Verkauf |
| Reifenservice | 15 | immer negativ | eingekaufte Fremdleistung |

Die Vorzeichen sind im Referenzjahr **ausnahmslos konsistent** — das lässt sich
als Plausibilitätsprüfung nutzen.

Größter Partner: **Knoll mit 370 von 527 Einkäufen** (Teilelieferant). Der Rest
sind Kleinbeträge.

**Fahrzeuge brauchen eigene Kategorien.** Im Bestand laufen Fahrzeugan- und
-verkäufe („EK Opel Vivaro", −8.000 €; „VK VW Golf 1633") unter demselben
Präfix wie eine Tüte Schrauben. Fahrzeuge sind **Wareneinsatz und Erlös**, keine
Betriebsausgabe.

### M-27 — Belegerkennung in zwei Stufen

**Stufe 1, jetzt:** Upload von PDF oder Bild des Lieferantenbelegs als
**Anhang an der Buchung**. Das fehlt bisher vollständig — es gibt nur
Beleg-PDFs für eigene Rechnungen. Der Anhang bleibt in jedem Fall erhalten, er
ist der Nachweis fürs Finanzamt. Dazu Handeingabe der Buchungsdaten.

**Stufe 2, später:** Automatische Erkennung als **Vorschlag**, nicht als
Automatik — Betrag, Datum, Lieferant, Steuersatz werden vorgeschlagen, der
Nutzer korrigiert oder bestätigt.

**Zur Hardware:** Auf 8 GB RAM ohne Grafikkarte ist ein Vision-Modell nicht
realistisch; dots.ocr und Verwandte brauchen 8 GB **VRAM** aufwärts. Auf CPU
liefen PaddleOCR oder Tesseract, die aber nur Rohtext erzeugen — die
Feldextraktion bleibt der ganze Aufwand. Deshalb Stufe 2 erst auf dem geplanten
lokalen KI-Server mit Grafikkarte. **Die Anwendung muss ohne Erkennung
vollständig benutzbar sein.**

---

## 8. Import aus dem Altsystem (Kfz-Kaufmann)

### M-28 — Alles übernehmen, die Suche zuerst

**Alles** wird übernommen, etwa 8 bis 10 Jahre Bestand. Alte Kunden, alte
Rechnungen, alte Belege müssen vollständig wiederfindbar sein.

Die **Suche** wird bei diesem Bestand die meistgenutzte Funktion der Anwendung:
über Kunde, Kennzeichen, Fahrgestellnummer, Belegnummer und Datum. Sie ist
entsprechend zu priorisieren.

### M-29 — Nummernkreise bleiben getrennt

Importierte Belege behalten ihre **Originalnummer in einem eigenen Feld**. Sie
laufen nicht in den neuen Zähler. Der neue Zähler startet frisch oder oberhalb
des höchsten Altwerts; eine Kollision darf es nicht geben.

Bei zusammengeführten Belegarten (Angebot + Kostenvoranschlag →
Kostenvoranschlag, M-15) bleiben die alten Nummern als Referenz erhalten, damit
ein Kunde mit altem Papier wiederfindbar ist.

### M-30 — Importierte Belege sind unveränderlich

Kein Bearbeiten, kein Stornieren, kein Mahnen. Nur ansehen und suchen. Sonst
müssten Prüfregeln für Datensätze gelten, die nie durch den Prozess der
Anwendung gelaufen sind. Siehe **P-08**.

### M-31 — PDFs werden neu erzeugt und sind als Nachdruck erkennbar

Die alten PDFs existieren nicht mehr. Sie werden beim Import **neu erzeugt** —
das ist in Ordnung, weil die Originale ausgedruckt im Ordner liegen.

**Verpflichtend:** Ein neu erzeugtes PDF muss als solches erkennbar sein, etwa
durch einen dezenten Hinweis im Dokument („Nachdruck aus Altdatenbestand").
Niemand darf eine Rekonstruktion für das Original halten.

Liegen die alten Firmendaten im Altbestand vor, werden sie übernommen und
gedruckt. Andernfalls muss der Hinweis so deutlich sein, dass eine abweichende
Anschrift oder Steuernummer klar als Rekonstruktion erkennbar ist.

### M-32 — Der Kassenbuch-Import geht von unsauberen Daten aus

**Wichtig:** Das ausgewertete Jahr 2026 ist bereits korrigiert und ungewöhnlich
aufgeräumt. Die älteren Jahrgänge sind deutlich inkonsistenter. Der Import muss
von **unsauberen** Daten ausgehen, nicht von diesem Stand.

Aus dem Buchungstext werden **Kategorie (Präfix)** und **Partner (Rest)**
abgeleitet. Dabei gilt:

- Groß- und Kleinschreibung spielt **keine Rolle**
- Umlaute in allen Varianten (ü/ue/u, ß/ss)
- Tippfehler in Partnernamen über **Ähnlichkeitsvergleich** zusammenführen
- Leerzeichen, Bindestriche und Mehrfachleerzeichen ignorieren
- Präfixe auch in abweichender Schreibweise erkennen
- Zusätze wie interne Fahrzeugnummern im Text tolerieren

**Nichts raten.** Wo die Zuordnung nicht eindeutig ist, scheitert der Import
nicht und erfindet auch nichts. Der Fall landet in einer **Prüfliste mit
Vorschlag**, ein Mensch entscheidet einmal — und die Entscheidung wird als
**Zuordnungsregel gespeichert**, damit dieselbe Schreibweise nicht zweimal
gefragt wird.

---

## 9. Kommunikation & System

### M-33 — Anfragen werden in der Anwendung bearbeitet

Nicht per Mail im Postfach.

- Status: **neu, in Bearbeitung, erledigt**
- Die Anfrage hängt zunächst an **keinem Kunden** — wer das Formular ausfüllt,
  ist zunächst nur ein Name mit Telefonnummer
- Zwei Wege hinaus: einem bestehenden Kunden zuordnen, oder daraus einen neuen
  Kunden anlegen

**Kein automatischer Termin.** Das Kontaktformular bietet **keine Terminwahl**,
nur Anliegen und Kontaktdaten. Termine werden immer individuell abgesprochen,
weil die Kapazität der Werkstatt nicht vorab bekannt ist. Der Kalendereintrag
entsteht anschließend von Hand.

Nutzen: nichts geht im Postfach unter, und es ist sichtbar, wie viele Anfragen
zu Aufträgen wurden.

### M-34 — Das Versandprotokoll wird allgemein, der Status ehrlich

**Heute** zeigt es nur auf den Beleg. Verschickt werden aber auch
Zahlungserinnerungen, Wechsel-Erinnerungen und Antworten auf Anfragen.

Statt eines Belegverweises zwei Felder: **Art des Vorgangs** und **dessen
Kennung**. Dazu Empfänger, Zeitpunkt, Betreff, verwendete Vorlage und Status.

**Der Status wird ehrlich benannt.** Über den eigenen Postausgang ist nur
feststellbar, dass der Server die Mail **angenommen** hat — nicht, dass sie
zugestellt wurde. Also: `angenommen`, `abgelehnt`, `Fehler beim Versand`.
**Nicht „zugestellt".** Eine echte Zustellbestätigung ist nicht gefordert.

---

## 10. Kennzahlen und Diagramme

### M-35 — Diagramme an allen wichtigen Stellen, mit wählbarem Zeitraum

Bewusst einfach: nur die Schlüsselfaktoren, die Controlling und Inhaber
wirklich brauchen. Nicht überladen.

**Kassenbuch**

- Einnahmen gegen Ausgaben im Zeitverlauf
- Kassenbestand als Kurve
- Ausgaben nach Kategorie — macht sofort sichtbar, dass Knoll der große Posten
  ist

**Weitere Stellen**

- Umsatz je Monat, aufgeteilt nach Werkstatt, Fahrzeugverkauf, Reifenhandel
- Offene Forderungen nach Alter
- Auslastung über die Tafel
- Fahrzeug: Marge zwischen An- und Verkauf
- Preis- und Lohnverläufe (M-02)

**Grundsatz:** Kennzahlen werden **immer aus den Daten gerechnet, nie
zwischengespeichert**. Sonst zeigt das Diagramm etwas anderes als die Liste
darunter. Siehe **P-09**.

---

## 11. Sicherheit

### M-36 — Anmeldung so sicher, als wäre das Netz fremd

Alles läuft im Haus per WLAN. Trotzdem bleibt ein **Cloud-Hosting auf einem
eigenen Server** offen — die Anmeldung muss also so sicher sein, als wäre das
Netz nicht vertrauenswürdig.

- **Kein Zwei-Faktor.** Ausdrücklich nicht gewünscht.
- Sitzungen mit Ablauf, verschlüsselte Verbindung
- **Drossel bei Anmeldeversuchen**, gestaffelt **nach Adresse und nach Konto**,
  damit Durchprobieren sofort abgeblockt wird
- **Fehlversuche protokollieren**, damit sichtbar wird, wenn jemand systematisch
  probiert
- Allgemeine Begrenzung auch auf den übrigen Schnittstellen, nicht nur bei der
  Anmeldung

**Ergänzt am 13.09.2026.** Die Drossel je Minute ist eine Bremse, keine Sperre:
wer geduldig ist und die Adresse wechselt, kommt auf 20 Versuche je Minute. Im
Haus ist das theoretisch — sobald die Anwendung auf einem eigenen Server im
Internet steht, ist es das nicht mehr. Deshalb zusätzlich:

- **Gestaffelte Sperre** (verschärft am 17.09.2026). Gezählt werden die
  Fehlversuche der letzten **24 Stunden**:

  | Fehlversuche | Folge |
  | --- | --- |
  | 1–2 | nichts |
  | **3** | 10 Minuten Ruhe |
  | **10** | 24 Stunden Ruhe |
  | **20** | **dauerhaft gesperrt** — nur der Administrator hebt das auf |

  Die Anmeldeseite zeigt die verbleibende Zeit als ablaufenden Zähler, damit
  niemand raten muss. Die Minutengrenzen bleiben zusätzlich bestehen; sie
  fangen die Flut ab, bevor überhaupt gerechnet wird.

- **Konto und Adresse werden getrennt gezählt** (P-15). Wer einen
  **unbekannten** Benutzernamen durchprobiert, sperrt seine **Adresse** — es
  gibt kein Konto, das man sperren könnte, und genau dieses Muster verrät den
  Angriff. Wer ein **bekanntes** Konto mit falschem Passwort beklopft, sperrt
  **beides**: das Konto und die Adresse.

  **Eine Adresssperre betrifft nur neue Anmeldungen.** Wer bereits angemeldet
  ist, arbeitet weiter. Sonst legte ein Tippfehler den halben Betrieb still,
  weil im Haus alle hinter derselben Adresse sitzen.

- **Der Administrator hebt jede Sperre sofort auf.** Auf der Benutzerseite ein
  Knopf dafür, daneben die letzten Fehlversuche und „Passwort neu setzen".
  Damit ist der einzige echte Einwand gegen eine Sperre — jemand sperrt einen
  Kollegen aus — im Betrieb in einer Minute erledigt. Siehe **P-13**.

- **Eine dauerhafte Sperre und eine Adresssperre melden sich per E-Mail** an
  die im Setup hinterlegte Adresse (P-16). Eine Sperre, die niemand bemerkt,
  ist eine Sperre, die erst am nächsten Morgen auffällt — und dann weiß
  niemand, ob jemand angegriffen wurde oder sich nur vertippt hat.

- **Deaktivieren ist etwas anderes als Sperren.** Ein Konto wird *deaktiviert*,
  wenn jemand länger weg ist — das ist eine Verwaltungshandlung ohne Anlass.
  *Gesperrt* wird es durch Fehlversuche. Beides steht getrennt im Protokoll und
  wird in der Oberfläche getrennt benannt.

- **Das Passwort ist die einzige Hürde**, weil es keinen zweiten Faktor gibt.
  Gegen ein schwaches Passwort hilft keine Drossel: `sommer2024` findet man
  nicht mit 29.000 Versuchen am Tag, sondern mit dreien. Beim **Setzen** eines
  Passworts gilt deshalb eine Mindestanforderung, und es wird gegen bekannte
  Passwörter geprüft — **online, aber ohne das Passwort preiszugeben**. Siehe
  **P-14** und **E-23**.
- **Kein Zurücksetzen als Selbstbedienung.** Ein Weg über die E-Mail macht das
  Postfach zum Schlüssel für die Anwendung — neue Angriffsfläche, und ohne
  zweiten Faktor dahinter. Bei acht Leuten mit erreichbarem Chef ist der Nutzen
  gering. Der Administrator setzt das Passwort neu, auf derselben Seite wie den
  Entsperr-Knopf. Damit entfällt auch die frühere Forderung nach einer Bremse
  beim Zurücksetzen: es gibt keinen Weg, den man bremsen müsste.

---

## 12. Datensicherung

### M-37 — Sichern und Zurückspielen über die Oberfläche

Beides ohne Kommandozeile bedienbar.

**Von Hand**

- Vollständiger Export aller Daten **samt Anhängen und PDFs**, in einem offenen,
  sinnvollen Format
- Der Import muss denselben Export **auf eine leere Installation
  zurückspielen** können — sonst ist es kein Backup, sondern ein Download
- Zurückspielen ohne Folgeprobleme: Nummernkreise, Verweise, Dateien

**Automatisch**

- **Versionierte** Sicherungen über **SSH**, verschlüsselt, mit
  **Schlüsseldatei**, die über die Oberfläche hochgeladen wird
- Einrichtung über einen **Zeitplan**, grafisch konfigurierbar
- **Sichtbarer Status:** wann lief die letzte Sicherung, war sie erfolgreich —
  es muss auffallen, wenn sie seit Wochen stillsteht

**Beim Aufsetzen verpflichtend:** eine Rückspielung mindestens einmal erproben.
Ein Backup, das nie zurückgespielt wurde, ist eine Vermutung.

---

## 11a. Löschen und Archivieren

### M-38 — Gelöscht wird nur, woran noch nichts hängt

**Festgelegt am 17.09.2026.** Die Regel gilt für **jeden** Datensatz der
Anwendung gleich — Kunde, Fahrzeug, Reifen, Artikel, Mitarbeiter, Lieferant,
Beleg, Auftrag.

> **Hängt an einem Datensatz ein eigener Vorgang, wird er nicht gelöscht,
> sondern archiviert.** Gelöscht wird nur, woran noch nichts hängt.

Der Anwendungsfall fürs Löschen ist eng und soll es bleiben: jemand legt etwas
an, sieht sofort, dass es Unsinn war, und nimmt es zurück. Alles andere wird
**archiviert** — der Datensatz verschwindet aus Listen und Auswahlen und bleibt
vollständig erhalten, mit allem, was daran hängt.

**Warum so streng.** Nachvollziehbarkeit ist das Ziel, nicht Aufgeräumtheit.
Eine Datenbank, in der ein Vorgang verschwinden kann, beantwortet die Frage
„was ist damals passiert" irgendwann nicht mehr. Und die Grenze „was ist
buchhalterisch relevant" ist im Einzelfall schwer zu ziehen — die Grenze „hängt
da etwas dran" ist es nicht.

**Was ein eigener Vorgang ist** (sperrt das Löschen):

| | |
| --- | --- |
| Belege | Rechnung **und** Kostenvoranschlag, auch stornierte |
| Zahlungen | jede erfasste Zahlung |
| Buchungen | Kassenbuch und Sachkonto, mit Anhang |
| Geldvorgänge am Fahrzeug | Ankauf, Verkauf |
| Aufträge | mit ihrer Nummer |
| Termine | im Kalender |
| Radsätze | mit Nummer und Lagerplatz — Inventar |
| Zahlungserinnerungen | wurden versendet |
| Anfragen | werden bearbeitet und haben einen Stand |
| Gehaltsstände | Personalunterlagen |

**Was Beiwerk ist** (geht mit):

| | |
| --- | --- |
| Am Fahrzeug | Kennzeichen-Historie, Halter-Historie, Fotos, Unterlagen, Inserat |
| Am Beleg | Positionen, erzeugte PDFs |
| Am Auftrag | Positionen und deren Zuweisungen |
| Am Reifen und am Artikel | Preisstände, Fotos |
| Am Mitarbeiter | Abwesenheiten |
| An der Buchung | Beleganhänge |

Beiwerk hat keinen eigenen Vorgangscharakter: es existiert nur als Teil seines
Datensatzes und wird ohne ihn sinnlos.

**Was der Bediener sieht.** Geht es nicht, steht der Grund da:

> **Dieses Fahrzeug lässt sich nicht löschen.** Daran hängen 3 Rechnungen und
> 1 Auftrag. Aus buchhalterischen Gründen bleibt beides erhalten — archivieren
> Sie das Fahrzeug stattdessen.

Und daneben die Schaltfläche zum Archivieren. Der Bediener entscheidet nichts
über Verweise; er entscheidet nur, ob archiviert wird.

**Jede Liste bekommt einen Reiter „Archiviert".** Was archiviert ist,
verschwindet aus der normalen Liste, aus jeder Auswahl und aus der globalen
Suche — aber es ist an genau einer Stelle wieder auffindbar, und von dort aus
reaktivierbar.

**Folge für E-11.** Die dort beschlossene Kaskade beim Löschen eines Kunden
entfällt. Ein Kunde mit Terminen, Aufträgen oder Belegen wird archiviert. Die
Vorschau aus E-11 bleibt — aber als **Auskunft**, nicht als Auswahl.

**Was daraus technisch folgt.** Es gibt keine Löschregel mehr, die von einem
Feldwert abhängt: ein Fremdschlüssel sperrt oder er geht mit, und das steht
fest. Damit ist auch der Kunstgriff aus **E-22** hinfällig, und der
Löschvorgang braucht keine ausdrücklichen `UPDATE`-Schritte mehr. Die Datenbank
allein reicht.

Siehe **P-11**.

---

## 13. Prüfregeln

Diese Regeln folgen **nicht** aus dem Datenmodell. Sie müssen als Fachlogik
programmiert **und getestet** werden. Ein Test je Regel, dessen Name mit der
Kennung beginnt.

| Nr. | Regel | Woher |
| --- | --- | --- |
| **P-01** | Je Auftrag höchstens **eine gültige Rechnung**; Storni zählen nicht mit | M-09 |
| **P-02** | Die Belegnummer wird **transaktional mit Zeilensperre** gezogen, erst beim Ausstellen | M-14 |
| **P-03** | Je Fahrzeug ist **genau ein Radsatz montiert** | M-17 |
| **P-04** | Ein Reifen mit **aktivem** eBay-Angebot lässt sich nicht löschen | M-20 |
| **P-05** | Beleg-Validierung **je Belegart** — kein Zahlungsziel, keine Mahnstufe am Kostenvoranschlag | M-15 |
| **P-06** | Durchlaufposten werden **umsatzsteuerfrei und getrennt** ausgewiesen | M-21 |
| **P-07** | Nur **Barzahlungen** erzeugen einen Kassenbuch-Vorschlag | M-16 |
| **P-08** | Importierte Belege sind **unveränderlich** | M-30 |
| **P-09** | **Saldo und Kennzahlen** werden gerechnet, nie gespeichert | M-23, M-35 |
| **P-10** | Gehaltsdaten sind **ausschließlich** über das Personalmodul erreichbar | M-04 |
| **P-11** | Hängt ein **eigener Vorgang** daran, sperrt er das Löschen; die Meldung nennt ihn und bietet das Archivieren an | M-38 |
| **P-12** | Archiviertes verschwindet aus Listen, Auswahlen und Suche und ist **nur** über den Reiter „Archiviert" erreichbar | M-38 |
| **P-13** | Anmeldeversuche werden **gestaffelt** gesperrt: 3 → 10 Minuten, 10 → 24 Stunden, 20 → dauerhaft | M-36 |
| **P-14** | Ein neu gesetztes Passwort erfüllt die **Mindestanforderung** und wird gegen bekannte Passwörter geprüft, **ohne es preiszugeben** | M-36 |
| **P-15** | Ein Fehlversuch auf einen **unbekannten** Benutzernamen sperrt die **Adresse**; auf ein bekanntes Konto sperrt er **Konto und Adresse** | M-36 |
| **P-16** | Eine dauerhafte Sperre und eine Adresssperre **melden sich per E-Mail** an die im Setup hinterlegte Adresse | M-36 |

---

## 14. Was gestrichen wird

Zum Nachhalten, damit es beim Umsetzen nicht versehentlich wieder auftaucht.

| Gestrichen | Kennung |
| --- | --- |
| Tabelle **Zeiteintrag** (`time_entries`), vollständig | M-10 |
| **Modul Zeiterfassung** mit allem daran: F-090, F-382, F-506–F-519, F-523 | M-10 |
| Berechtigung `hours` und `hours:write_own`, Menüeintrag „Stunden" | M-10, M-04 |
| Golden Flow „Zeiterfassung" — der Platz **G-11** trägt jetzt die Rückspielprobe | M-10, M-37 |
| Verweis **Auftrag → Rechnung** (die Gegenrichtung bleibt) | M-08 |
| Belegarten **Angebot** und **Auftragsbestätigung** samt Feldern | M-15 |
| Sperrender Einzelverweis **Auftragsposition → Mitarbeiter** | M-11 |
| Tabelle **Reifeneinlagerung** in ihrer alten Form | M-17 |
| **Versionierung der Firmeneinstellung** — nicht anlegen | M-03 |
| **Feingranulare Berechtigungen** — nicht anlegen | M-04 |
| **Zwei-Faktor-Anmeldung** — nicht anlegen | M-36 |
| **Trennung erfasste/abgerechnete Zeit** — nicht anlegen | M-10 |
| **Erfassung von Innenzeiten** — nicht anlegen | M-10 |
| **Automatische Terminbuchung** aus der Anfrage — nicht anlegen | M-33 |
| **Passwort-Zurücksetzen als Selbstbedienung** — nicht anlegen | M-36 |
| **Bremse beim Zurücksetzen** — hinfällig, es gibt keinen solchen Weg | M-36 |

---

## 15. Was daraus für den Arbeitsplan folgt

| Paket | Änderung |
| --- | --- |
| **T-005** | Datenmodell erneut: Ereignisprotokoll, Radsatz, Halter-Historie, Belegfelder, gestrichene Tabellen und Verweise |
| **T-006** | Nummernvergabe mit Zeilensperre (P-02); Kennzahlen nie speichern (P-09) |
| **T-007** | Drossel auch je Konto, Fehlversuche protokollieren, gestaffelte Kontosperre (M-36, P-13) |
| **T-010** | Mindestanforderung und Abgleich beim Setzen des ersten Passworts (P-14) |
| **T-009** | Zeitstrahl- und Diagrammkomponenten (M-02, M-35) |
| **T-011** | Kundenart steuert die Oberfläche, eBay-Käufer ausgeblendet (M-07) |
| **T-018** | Zeiterfassung entfällt; übrig bleiben die Öffnungszeiten (M-10) |
| **T-012 ff.** | Fahrzeugstatus, Halter-Historie, Zeitstrahl, Löschregeln mit Vorschau (M-05, M-06, P-11, P-12) |
| **T-016 ff.** | Tafel mit mobiler Erfassung an der Position, Zuweisung je Position (M-11, M-13) |
| **T-020 ff.** | Zwei Belegarten, Einfrieren beim Ausstellen, Durchlaufposten (M-03, M-15, M-21) |
| **T-021** | Kostenvoranschlag statt Angebot; Angebot und Auftragsbestätigung entfallen (M-15) |
| **T-022** | Zahlarten, Kassenbuch-Vorschlag nur bei bar (M-16, M-24) |
| **T-023** | Nur noch zwei Belegvorlagen, dazu der Nachdruck-Vermerk (M-15, M-31) |
| **T-024 ff.** | Radsatz, Ein-Klick-Service, Erinnerung am Radsatz (M-17, M-18, M-19) |
| **T-028** | Kassenbuch: Saldo gerechnet, Herkunft, Kategorien, Anhänge (M-23…M-27) |
| **T-033** | Import: alles, Nummernkreise getrennt, unveränderlich, Nachdruck, Prüfliste (M-28…M-32) |
| **T-034** | Entsperren, letzte Fehlversuche, Passwort neu setzen — alles auf der Benutzerseite (P-13, P-14) |
| **neu** | Datensicherung über die Oberfläche (M-37) |

Die genaue Umarbeitung der Pakete steht in
[06-arbeitsplan.md](06-arbeitsplan.md).

---

## 16. Zuordnung — welches Paket erledigt was

Maschinell ausgewertet von `pnpm test:modell`: sobald das Paket in
[fortschritt.md](fortschritt.md) als fertig steht, verlangt die Prüfung zu
jeder Kennung einen Test, dessen Name mit ihr beginnt.

| Kennung | Paket | Kurz |
| --- | --- | --- |
| M-01 | T-005 | Ereignisprotokoll statt Versionstabellen |
| M-02 | T-009 | Historie als Zeitstrahl |
| M-03 | T-020 | Beleg friert beim Ausstellen ein |
| M-04 | T-019 | Lohn nur im Personalmodul |
| M-05 | T-005 | Fahrzeug überlebt den Kunden, Statusfeld |
| M-06 | T-005 | Halter-Historie |
| M-07 | T-011 | eBay-Käufer: gleiche Tabelle, andere Oberfläche |
| M-08 | T-005 | doppelter Verweis Auftrag ↔ Beleg aufgelöst |
| M-09 | T-020 | Belegregeln je Auftrag |
| M-10 | T-005 | Zeiteintrag gestrichen |
| M-11 | T-005 | Zuweisung auf Positionsebene |
| M-12 | T-019 | Mitarbeiter deaktivieren statt löschen |
| M-13 | T-016 | Tafel mit mobiler Erfassung an der Position |
| M-14 | T-006 | Belegnummer beim Ausstellen, mit Zeilensperre |
| M-15 | T-005 | zwei Belegarten |
| M-16 | T-022 | Zahlarten, nur bar ins Kassenbuch |
| M-17 | T-005 | Radsatz ersetzt Einlagerung |
| M-18 | T-024 | Reifenservice mit einem Klick |
| M-19 | T-005 | Wechsel-Erinnerung am Radsatz |
| M-20 | T-024 | aktives eBay-Angebot sperrt den Reifen |
| M-21 | T-020 | Durchlaufposten umsatzsteuerfrei getrennt |
| M-22 | T-005 | Standardartikel als Liste |
| M-23 | T-028 | Saldo gerechnet, nicht gespeichert |
| M-24 | T-028 | Kassenbuch von Hand, mit Vorschlagsliste |
| M-25 | T-005 | Herkunftsmerkmal je Buchung |
| M-26 | T-028 | Kategorien inklusive Fahrzeuge |
| M-27 | T-028 | Beleganhang an der Buchung |
| M-28 | T-033 | Import übernimmt alles, Suche zuerst |
| M-29 | T-005 | Nummernkreise getrennt |
| M-30 | T-033 | importierte Belege unveränderlich |
| M-31 | T-033 | PDFs neu erzeugt, als Nachdruck kenntlich |
| M-32 | T-033 | Kassenbuch-Import mit Prüfliste und Regelgedächtnis |
| M-33 | T-005 | Anfrage mit Status, kein automatischer Termin |
| M-34 | T-005 | Versandprotokoll allgemein, Status ehrlich |
| M-35 | T-009 | Diagramme, immer gerechnet |
| M-36 | T-007 | Drossel je Adresse und Konto, Fehlversuche protokolliert |
| M-37 | T-043 | Datensicherung über die Oberfläche |
| P-01 | T-020 | höchstens eine gültige Rechnung je Auftrag |
| P-02 | T-006 | Belegnummer transaktional mit Zeilensperre |
| P-03 | T-024 | genau ein Radsatz montiert |
| P-04 | T-024 | aktives Angebot sperrt den Reifen |
| P-05 | T-020 | Beleg-Validierung je Belegart |
| P-06 | T-020 | Durchlaufposten getrennt ausgewiesen |
| P-07 | T-022 | nur Barzahlungen erzeugen einen Vorschlag |
| P-08 | T-033 | importierte Belege unveränderlich |
| P-09 | T-028 | Saldo und Kennzahlen gerechnet |
| P-10 | T-019 | Gehaltsdaten nur über das Personalmodul |
| M-38 | T-011 | gelöscht wird nur, woran noch nichts hängt |
| P-11 | T-011 | ein eigener Vorgang sperrt das Löschen |
| P-12 | T-011 | Archiviertes nur über den eigenen Reiter |
| P-13 | T-007 | gestaffelte Sperre 3 / 10 / 20 |
| P-14 | T-010 | Mindestanforderung und Abgleich beim Passwort |
| P-15 | T-007 | Adresssperre bei unbekanntem Benutzernamen |
| P-16 | T-026 | E-Mail bei dauerhafter Sperre und Adresssperre |
