/**
 * Adressbereiche — der sichere Bereich aus den Einstellungen (P-22).
 *
 * Der Betrieb läuft im Haus **und** von unterwegs. Beides muss gehen, und auch
 * eine interne Adresse darf gesperrt werden: ein Angriff kann aus dem eigenen
 * Netz kommen, etwa von einem Rechner, den jemand mitgebracht hat.
 *
 * Damit sich der Betrieb dabei nicht selbst aussperrt, steht in den
 * Einstellungen ein **sicherer Bereich**. Was darin liegt, wird nie gesperrt.
 * Leer gelassen gilt die Sperre überall — das ist die Voreinstellung, denn
 * eine Ausnahme soll jemand bewusst eintragen.
 *
 * Verstanden werden drei Schreibweisen, weil Menschen sie so aufschreiben:
 * eine einzelne Adresse (`192.168.1.7`), ein Netz in CIDR-Schreibweise
 * (`192.168.1.0/24`) und ein Bereich mit Bindestrich (`192.168.1.10-50`).
 *
 * Hier wird **nur gerechnet**, nichts gelesen und nichts geschrieben — damit
 * sich jede Kante prüfen lässt, ohne eine Datenbank zu starten.
 */

/** Eine IPv4-Adresse als Zahl, oder `null`, wenn es keine ist. */
export function ipv4ToNumber(address: string): number | null {
  const parts = address.trim().split('.')
  if (parts.length !== 4) return null

  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value
}

/**
 * Ob eine Adresse in einem Eintrag liegt.
 *
 * Ein unverständlicher Eintrag trifft **nie** zu. Ein Tippfehler in den
 * Einstellungen darf nicht dazu führen, dass plötzlich alles als sicher gilt —
 * lieber sperrt die Anwendung zu viel als zu wenig.
 */
export function matchesEntry(address: string, entry: string): boolean {
  const candidate = ipv4ToNumber(address)
  if (candidate === null) return false

  const text = entry.trim()
  if (text === '') return false

  // CIDR: 192.168.1.0/24
  const cidr = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(text)
  if (cidr) {
    const base = ipv4ToNumber(cidr[1]!)
    const bits = Number(cidr[2])
    if (base === null || bits > 32) return false
    if (bits === 0) return true
    const mask = (0xFFFFFFFF << (32 - bits)) >>> 0
    return (candidate & mask) >>> 0 === (base & mask) >>> 0
  }

  // Bereich: 192.168.1.10-50 oder 192.168.1.10-192.168.1.50
  const range = /^(\d{1,3}(?:\.\d{1,3}){3})\s*-\s*(\d{1,3}(?:\.\d{1,3}){3}|\d{1,3})$/.exec(text)
  if (range) {
    const from = ipv4ToNumber(range[1]!)
    if (from === null) return false

    const rightSide = range[2]!
    const to = rightSide.includes('.')
      ? ipv4ToNumber(rightSide)
      // Kurzform: nur das letzte Glied, etwa `192.168.1.10-50`.
      : ipv4ToNumber(`${range[1]!.split('.').slice(0, 3).join('.')}.${rightSide}`)

    if (to === null || to < from) return false
    return candidate >= from && candidate <= to
  }

  // Einzelne Adresse
  const single = ipv4ToNumber(text)
  return single !== null && single === candidate
}

/**
 * Ob eine Adresse im sicheren Bereich liegt.
 *
 * Die Einstellung ist ein Text mit einem Eintrag je Zeile oder durch Kommata
 * getrennt — so, wie jemand ihn in ein Feld schreibt. Leerzeilen und alles
 * hinter einem `#` werden übergangen, damit eine Notiz danebenstehen kann.
 */
export function isSafeAddress(address: string | null | undefined, setting: string): boolean {
  if (!address) return false

  for (const raw of setting.split(/[\n,;]/)) {
    const entry = raw.split('#')[0]?.trim() ?? ''
    if (entry === '') continue
    if (matchesEntry(address, entry)) return true
  }
  return false
}

/**
 * Ob ein Eintrag überhaupt verstanden wird — für die Prüfung im Formular.
 *
 * Ein Eintrag, den niemand versteht, gehört zurückgewiesen, **bevor** er
 * gespeichert wird. Sonst steht er in den Einstellungen, wirkt nie, und
 * niemand merkt es — bis sich jemand aussperrt.
 */
export function isUnderstoodEntry(entry: string): boolean {
  const text = entry.trim()
  if (text === '') return false

  const cidr = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(text)
  if (cidr) return ipv4ToNumber(cidr[1]!) !== null && Number(cidr[2]) <= 32

  const range = /^(\d{1,3}(?:\.\d{1,3}){3})\s*-\s*(\d{1,3}(?:\.\d{1,3}){3}|\d{1,3})$/.exec(text)
  if (range) {
    const from = ipv4ToNumber(range[1]!)
    if (from === null) return false
    const right = range[2]!
    const to = right.includes('.')
      ? ipv4ToNumber(right)
      : ipv4ToNumber(`${range[1]!.split('.').slice(0, 3).join('.')}.${right}`)
    return to !== null && to >= from
  }

  return ipv4ToNumber(text) !== null
}

/** Jeder Eintrag einer Einstellung, der nicht verstanden wird. */
export function unknownEntries(setting: string): string[] {
  const broken: string[] = []
  for (const raw of setting.split(/[\n,;]/)) {
    const entry = raw.split('#')[0]?.trim() ?? ''
    if (entry === '') continue
    if (!isUnderstoodEntry(entry)) broken.push(entry)
  }
  return broken
}
