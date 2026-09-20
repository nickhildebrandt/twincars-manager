/**
 * Belegnummern und ihre Stände (M-44, festgelegt am 20.09.2026).
 *
 * Zwei Belegarten, zwei Regeln — und der Grund dafür liegt nicht in der
 * Anwendung, sondern in der Buchhaltung:
 *
 *   - **Kostenvoranschlag**: ein Vorgang, eine Nummer. Jeder weitere Stand
 *     hängt seinen Zähler an: `KV-2026-0042`, `KV-2026-0042-2`,
 *     `KV-2026-0042-3`. Der Kunde sieht denselben Beleg in zweiter Fassung,
 *     nicht zwei Belege, die er vergleichen muss.
 *   - **Rechnung**: jeder Stand ist ein eigener Beleg mit einer eigenen,
 *     lückenlos fortlaufenden Nummer. Eine korrigierte Rechnung bekommt eine
 *     ganz andere Nummer; die alte bleibt bestehen und wird storniert. Ein
 *     Zusatz `-2` ist hier **nicht** zulässig.
 *
 * Dazu die dritte Art von Nummer, die es im Bestand gibt: die **übernommene**
 * aus dem Altsystem. Sie bleibt, wie sie ist (M-29) — sie steht auf
 * Ausdrucken, die beim Kunden im Ordner liegen. Sie wird nie umnummeriert und
 * läuft nie in den neuen Zähler.
 *
 * ## Warum hier nichts zerlegt wird
 *
 * Der erste Entwurf hatte ein `baseNumberOf('KV-2026-0042-3')`, das den Zusatz
 * abschnitt. Es war **zweideutig**, und die Tests haben es sofort gezeigt: die
 * Grundnummer endet selbst auf `-0042`. Ein Muster, das den Standzusatz
 * erkennt, erkennt auch den letzten Block der Grundnummer als solchen — und
 * aus `KV-2026-0042` würde `KV-2026`.
 *
 * Zurechtbiegen ließe sich das über die Anzahl der Ziffern oder über führende
 * Nullen. Beides hinge davon ab, wie der Nummernkreis gerade eingestellt ist,
 * und fiele in dem Augenblick um, in dem jemand das Format ändert.
 *
 * Deshalb wird **nicht gerechnet, sondern nachgeschlagen**: die Grundnummer
 * ist die Nummer von Stand 1 derselben Kette, und die steht in der Datenbank.
 * Den Stand kennt die Spalte `documents.version`. Keine Zeichenkette muss je
 * wieder auseinandergenommen werden.
 *
 * Hier steht deshalb nur noch die Regel selbst. Das Ziehen der nächsten Nummer
 * läuft mit Zeilensperre (P-02) und steht im Nummerndienst.
 */

/**
 * Die Nummer eines Standes, aus der Grundnummer und dem Zähler.
 *
 * Version 1 trägt die Grundnummer selbst — ein `-1` wäre Rauschen und stünde
 * auf jedem Beleg, der nie geändert wurde.
 */
export function versionedNumber(base: string, version: number): string {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Ungültige Version: ${version}`)
  }
  return version === 1 ? base : `${base}-${version}`
}

/**
 * Die Nummer, die ein Stand bekommen muss.
 *
 * Die eine Stelle, an der die Regel aus M-44 steht. Ein Aufrufer, der sie
 * umgeht, erzeugt eine Rechnung mit `-2` — und genau das darf es nicht geben.
 *
 * @param type       Belegart.
 * @param version    Der Stand, 1-basiert.
 * @param baseNumber Die Nummer von **Stand 1** derselben Kette, wörtlich, wie
 *                   sie in der Datenbank steht. Nicht die des Vorgängers und
 *                   nichts Abgeschnittenes. Nur beim Kostenvoranschlag ab
 *                   Stand 2 gebraucht.
 * @param drawNext   Zieht die nächste Nummer aus dem Kreis.
 */
export async function numberForVersion(options: {
  type: 'cost_estimate' | 'invoice'
  version: number
  baseNumber: string | null
  drawNext: () => Promise<string>
}): Promise<string> {
  if (options.version === 1) return options.drawNext()

  // Die Rechnung zieht immer neu. Eine korrigierte Rechnung ist ein eigener
  // Beleg, und die Nummernfolge muss lückenlos und eindeutig bleiben.
  if (options.type === 'invoice') return options.drawNext()

  if (!options.baseNumber) {
    throw new Error('Ein Kostenvoranschlag ab Stand 2 braucht die Nummer von Stand 1.')
  }

  return versionedNumber(options.baseNumber, options.version)
}

/**
 * Das Suchmuster, das alle Stände eines Vorgangs findet.
 *
 * Wer `KV-2026-0042` in die Suche tippt, meint den Vorgang und nicht nur den
 * ersten Stand. Ein Präfixvergleich leistet das, ohne irgendetwas zu zerlegen.
 *
 * Die Sonderzeichen von `LIKE` werden entwertet: ein `%` in einer eingetippten
 * Nummer soll eine Nummer sein und kein Platzhalter, der die halbe Tabelle
 * zurückgibt.
 */
export function numberSearchPattern(input: string): string {
  const escaped = input.trim().replace(/([\\%_])/g, '\\$1')
  return `${escaped}%`
}
