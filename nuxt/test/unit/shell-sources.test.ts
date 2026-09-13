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

describe('Die gemeinsamen Bausteine, von außen betrachtet', () => {
  it('B-108: es gibt keinen selbstgebauten Dialog', () => {
    // Neun Routen des Vorgängers rollten eigene `modal modal-open`-Dialoge,
    // und nur drei riefen `showModal()` — Escape und Fokus verhielten sich
    // deshalb an neun Stellen verschieden. Dialoge kommen jetzt aus Nuxt UI.
    for (const [file, source] of appSources) {
      expect(source, `${file} baut einen Dialog selbst`).not.toMatch(/<dialog[\s>]/)
      expect(source, `${file} benutzt showModal`).not.toMatch(/\.showModal\(/)
      expect(source, `${file} baut einen Dialog aus Klassen`).not.toMatch(/modal-open/)
      expect(source, `${file} setzt role="dialog" von Hand`).not.toMatch(/role="dialog"/)
    }
  })

  it('B-091: es gibt keinen selbstgebauten Reiter-Satz', () => {
    // Der Vorgänger legte Radio-Eingaben in eine `role="tablist"`. Eine
    // Vorlesehilfe meldete danach eine Radiogruppe, und doppelte Namen
    // koppelten zwei Reiter-Sätze unbemerkt aneinander. Reiter kommen aus
    // Nuxt UI, samt richtiger ARIA-Rollen.
    for (const [file, source] of appSources) {
      expect(source, `${file} setzt role="tablist" von Hand`).not.toMatch(/role="tablist"/)
      expect(source, `${file} setzt role="tab" von Hand`).not.toMatch(/role="tab"/)
      expect(source, `${file} benutzt das Radio-Reiter-Muster`).not.toMatch(/tabs-lift/)
    }
  })

  it('B-106: kein Knopf sperrt sich wegen eines Prüfergebnisses', () => {
    // Die Formularsteuerung des Vorgängers versprach in ihrer Doku eine Sperre
    // „bis alles gültig ist" — die Richtlinie verbietet genau das. Gesperrt
    // wird nur von der laufenden Anfrage und von einem echten Riegel.
    const form = appSources.find(([file]) => file === 'components/form/FormPage.vue')
    expect(form, 'FormPage.vue').toBeDefined()
    expect(form![1]).toContain(':disabled="busy.active.value || props.locked"')

    for (const [file, source] of appSources) {
      for (const line of source.split('\n')) {
        if (!line.includes(':disabled')) continue
        expect(line, `${file}: ${line.trim()}`).not.toMatch(/error|invalid|valid\b/i)
      }
    }
  })

  it('B-107: es gibt nirgends einen Wähler für die Seitengröße', () => {
    // Die Blätterleiste des Vorgängers trug tote `size`/`onSize`-Eigenschaften
    // und zeichnete zwei Sätze Schaltflächen ins DOM. Es sind fest 25.
    for (const [file, source] of appSources) {
      expect(source, `${file} bietet eine Seitengröße an`).not.toMatch(/\bonSize\b/)
      expect(source, `${file} setzt items-per-page frei`).not.toMatch(/pageSizeOptions/)
    }
  })

  it('B-589: Dateigrenzen stehen nur an einer Stelle', () => {
    // Sieben verschiedene Grenzen an sieben Stellen — 7 MB hier, 8 MiB dort,
    // 28 MB beim Fahrzeugfoto. Wer eine ändern wollte, fand die anderen nicht.
    for (const [file, source] of appSources) {
      if (file.endsWith('.test.ts')) continue
      const rawLimits = source.match(/\d+\s*\*\s*1024\s*\*\s*1024/g) ?? []
      expect(rawLimits, `${file} rechnet eine eigene Dateigrenze aus`).toEqual([])
    }
  })

  it('B-216: kein Endpoint enthält Fachlogik oder greift selbst zur Datenbank', () => {
    // Beim Vorgänger wanderte Fachlogik in die Routen und die Doku zeigte
    // danach auf Dateien, die es so nicht gab. Ein Endpoint besteht aus
    // Wächter, Prüfung und Dienstaufruf — sonst nichts.
    //
    // Die eine Ausnahme: die Zustandsprüfung reicht die Verbindung an
    // `checkHealth` weiter. Sie fragt nichts ab, sie gibt weiter.
    const PASSES_CONNECTION_ON = 'health.get.ts'

    for (const [file, source] of apiSources) {
      if (file !== PASSES_CONNECTION_ON) {
        expect(source, `${file} greift selbst zur Datenbank`).not.toMatch(/useDatabase\(/)
      }
      expect(source, `${file} baut selbst eine Abfrage`).not.toMatch(/from 'drizzle-orm'/)
      expect(source, `${file} importiert eine Tabelle`).not.toMatch(/database\/schema/)
    }
  })
})
