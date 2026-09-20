# 12 — Wie sehen die neuen Belegnummern aus?

**Betrifft:** M-44, M-29, T-010, T-021, T-033 · **Stand:** offen, der Assistent
schlägt etwas vor

## Worum es geht

Die Altnummern bleiben, wie sie sind — das ist entschieden (M-44). Die
Rechnungen aus Kfz-Kaufmann laufen von `20080001` bis `20090446`, achtstellig,
ohne Trennzeichen.

Offen ist, **womit der neue Kreis anfängt**. Die Nummer steht auf jeder
Rechnung, jeder Mahnung und jedem Kontoauszug; sie ist schwer zu ändern,
sobald die erste draußen ist.

## Drei Wege

| | **A — eigenes Schema** | **B — Altschema fortsetzen** | **C — Jahresblock wie bisher** |
| --- | --- | --- | --- |
| Die nächste Rechnung heißt | `RE-2026-0001` | `20090447` | `20260001` |
| Erkennbar als neu | sofort | gar nicht | am Jahr |
| Kollisionsgefahr mit Altnummern | keine | keine, aber knapp daneben | keine |
| Am Telefon | „R-E, 2026, 1" | „zwanzig-null-neun-null-vier-vier-sieben" | „zwanzig-sechsundzwanzig-eins" |
| Sortiert sich neben den alten | nein | ja | ja |

Rechtlich sind alle drei in Ordnung: verlangt ist, dass **im neuen Kreis**
lückenlos und eindeutig weitergezählt wird — nicht, dass der neue an den alten
anschließt.

## Was daran hängt

Nicht nur die Rechnung. Der Betrieb zieht aus **sieben** getrennten Kreisen:
Rechnung, Storno, Kostenvoranschlag, Kunde, Reifeneinlagerung, Auftrag,
Zahlungserinnerung. Die Antwort gilt sinngemäß für alle.

Und der Kostenvoranschlag hat die Zusatzregel aus M-44: ab dem zweiten Stand
hängt er an (`KV-2026-0042-2`). Bei Weg C sähe das aus wie `20260042-2` —
lesbar, aber die Ziffernwüste wird länger.

## Was heute umgesetzt ist

Nichts Festes. Der Assistent bekommt in **Schritt 4** ein Feld je Kreis mit
Format und Startwert, und eine Vorgabe, die man überschreiben kann.

## Was ich empfehle

**Weg A**, und als Vorgabe im Assistenten:

| Kreis | Vorgabe |
| --- | --- |
| Rechnung | `RE-{YYYY}-{NNNN}` |
| Storno | `ST-{YYYY}-{NNNN}` |
| Kostenvoranschlag | `KV-{YYYY}-{NNNN}` |
| Kunde | `K-{NNNNN}` |
| Auftrag | `A-{YYYY}-{NNNN}` |
| Einlagerung | `E-{YYYY}-{NNNN}` |
| Erinnerung | `M-{YYYY}-{NNNN}` |

Der Grund ist der Alltag, nicht die Ästhetik: ein Präfix sagt am Telefon und
auf dem Kontoauszug sofort, **was** für ein Beleg das ist. Eine achtstellige
Ziffernfolge sagt das nicht, und zwei davon nebeneinander verwechselt man.

**Kein Jahresreset.** Der Zähler läuft durch. Ein Reset erzeugt jedes Jahr die
Frage, ob `RE-2026-0001` und `RE-2027-0001` dieselbe Rechnung sind — und die
Antwort ist jedes Mal mühsam.
