/**
 * B-080: die Lücken im Testbestand des Vorgängers.
 *
 * Der Befund listet Kernpfade auf, für die es keinen einzigen Test gab —
 * Sperren eines Kontos, Befüllen der Sitzungsdaten, der Wächter selbst, das
 * Ziel nach der Anmeldung, die Abmeldung bei Untätigkeit. Dieser Test hält
 * fest, dass es sie jetzt gibt: nicht als Zusage, sondern nachprüfbar.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => {
  const path = fileURLToPath(new URL(`../${relative}`, import.meta.url))
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

/** Lücke aus B-080 → Datei, die sie schließt, und ein Beleg darin. */
const GAPS: [string, string, string][] = [
  ['Anmeldung eines gesperrten Kontos', 'integration/auth.test.ts', 'Deaktivierte Konten'],
  ['Sitzungsdaten am Request', 'integration/auth-middleware.test.ts', 'Sitzung und Rechte am Endpoint'],
  ['der Wächter selbst', 'unit/guards.test.ts', 'requirePermission'],
  ['Passwortwechsel', 'integration/auth.test.ts', 'Passwort zurücksetzen'],
  ['Deaktivierung beendet Sitzungen', 'integration/auth.test.ts', 'verlieren ihre laufende Sitzung sofort'],
  ['Rollen und Rechte', 'integration/auth.test.ts', 'sammelt die Rechte über alle Rollen'],
  ['Ziel nach der Anmeldung', 'unit/redirect.test.ts', 'safeRedirectTarget'],
  ['Abmeldung bei Untätigkeit', 'unit/idle.test.ts', 'idleStateAt'],
  ['Abmeldung über Tabs hinweg', 'browser/idle-logout.test.ts', 'BroadcastChannel'],
]

describe('Die genannten Lücken sind geschlossen', () => {
  it('B-080: jeder im Befund genannte Kernpfad hat einen Test', () => {
    for (const [gap, file, marker] of GAPS) {
      const source = read(file)
      expect(source, `${file} fehlt (${gap})`).not.toBe('')
      expect(source, `${file} enthält „${marker}" nicht`).toContain(marker)
    }
    expect(GAPS.length).toBeGreaterThanOrEqual(9)
  })

  it.each(GAPS)('%s — geprüft in %s', (_gap, file, marker) => {
    const source = read(file)
    expect(source, file).not.toBe('')
    expect(source, `${file} enthält „${marker}" nicht`).toContain(marker)
  })

  it('lässt keine toten Attrappen zurück', () => {
    // Der Befund nannte einen `signUpEmail`-Mock, den niemand mehr benutzte.
    // Es gibt keine Selbstregistrierung, also auch keine Attrappe dafür.
    for (const [, file] of GAPS) {
      expect(read(file), file).not.toContain('signUpEmail')
    }
  })
})
