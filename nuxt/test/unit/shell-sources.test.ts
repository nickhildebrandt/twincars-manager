/**
 * Was die Hülle im Quelltext benutzt.
 *
 * Zwei Befunde lassen sich nur so prüfen, weil sie von Abwesenheit handeln:
 * keine zweite Route-Quelle (B-020) und kein Schreibzugriff im Lesepfad
 * (B-033).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appDir = fileURLToPath(new URL('../../app', import.meta.url))
const apiDir = fileURLToPath(new URL('../../server/api', import.meta.url))

function sourcesIn(dir: string, base = dir): [string, string][] {
  const out: [string, string][] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourcesIn(full, base))
    else if (/\.(ts|vue)$/.test(entry)) {
      out.push([relative(base, full).replace(/\\/g, '/'), readFileSync(full, 'utf8')])
    }
  }
  return out
}

const appSources = sourcesIn(appDir)
const apiSources = sourcesIn(apiDir)

describe('Eine Quelle für die aktuelle Seite', () => {
  it('B-020: der Pfad wird nur über useRoute gelesen', () => {
    // Der Vorgänger mischte zwei APIs: die Hülle benutzte den veralteten
    // Store, der Rest den neuen Zustand. Zwei Quellen für dieselbe Sache
    // laufen irgendwann auseinander.
    for (const [file, source] of appSources) {
      expect(source, `${file} liest window.location`).not.toMatch(/window\.location\.pathname/)
      expect(source, `${file} liest den Verlauf direkt`).not.toMatch(/history\.state\b/)
    }
  })

  it('liest die aktive Markierung nur an einer Stelle', () => {
    // Welcher Eintrag hervorgehoben wird, entscheidet `activeItem` — genau
    // einmal, in shared/navigation.ts.
    const users = appSources.filter(([, source]) => source.includes('activeItem('))
    expect(users.map(([file]) => file)).toEqual(['composables/useNavigation.ts'])
  })
})

describe('Kein Schreibzugriff im Lesepfad', () => {
  it('B-033: kein Endpoint legt die Einstellungszeile an', () => {
    // Beim Vorgänger löste eine anonym erreichbare Abfrage ein INSERT in
    // `company_settings` aus, wenn die Tabelle leer war — ein Seiteneffekt in
    // einem Lesepfad, mit Wettlauf bei parallelen Erstanfragen.
    for (const [file, source] of apiSources) {
      expect(source, `${file} schreibt in company_settings`)
        .not.toMatch(/insert\(\s*companySettings/)
    }
  })

  it('legt die Zeile beim Seed an, vor dem ersten Request', async () => {
    const seed = readFileSync(
      fileURLToPath(new URL('../../server/database/seed/index.ts', import.meta.url)),
      'utf8',
    )
    expect(seed).toContain('seedCompanySettings')
    expect(seed).toMatch(/insert\(companySettings\)/)
  })
})

describe('Nichts Totes übernommen', () => {
  it('B-037: es gibt keine ungenutzten Symbole und keine Titel-Aliasse', () => {
    // Der Vorgänger schleppte einen nicht gerenderten Untertitel, einen
    // zweiten Namen für den Seitentitel und zwei Symbol-Importe mit, die
    // niemand benutzte.
    const navigation = readFileSync(
      fileURLToPath(new URL('../../shared/navigation.ts', import.meta.url)),
      'utf8',
    )

    // Jedes erklärte Symbol wird auch verwendet — die Liste ist die Verwendung.
    const icons = [...navigation.matchAll(/icon: '([^']+)'/g)].map(match => match[1]!)
    expect(new Set(icons).size).toBeGreaterThan(0)

    // Es gibt genau einen Weg zum Seitentitel, keinen zweiten Namen dafür.
    const users = appSources.filter(([, source]) => source.includes('titleFor('))
    expect(users.map(([file]) => file)).toEqual(['composables/useNavigation.ts'])
    for (const [file, source] of appSources) {
      expect(source, `${file} führt einen zweiten Titelzustand`).not.toMatch(/pageTitle/)
      expect(source, `${file} führt einen ungerenderten Untertitel`).not.toMatch(/subtitle/)
    }
  })
})
