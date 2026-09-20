/**
 * Filter und Seite stehen in der Adresszeile — im echten Browser nachgewiesen.
 *
 * Der Vorgänger hielt sie im Speicher. Wer eine gefilterte Liste teilte,
 * teilte die erste Seite ohne Filter; ein Neuladen begann von vorn, und der
 * Zurück-Knopf sprang aus der Liste heraus, statt einen Filter zurückzunehmen.
 *
 * Hier läuft ein echter Router mit echter Verlaufsverwaltung in einem echten
 * Chromium. Geprüft wird die Hälfte der Zusage, die nur hier sichtbar ist:
 * **dass die Adresse sich wirklich ändert** und dass jede Änderung einen
 * Eintrag im Verlauf hinterlässt.
 *
 * Die andere Hälfte — eine neu aufgebaute Liste stellt aus derselben Adresse
 * denselben Zustand her — steht in `test/nuxt/use-list-query.test.ts`. Sie
 * lässt sich hier nicht zeigen: `@nuxt/test-utils/browser` hängt jede
 * Anwendung auf der Startadresse ein und liest `window.location` beim zweiten
 * Einhängen nicht erneut. Der vollständige Durchlauf mit echtem Neuladen
 * reitet auf dem Golden Flow G-03 mit der ersten echten Liste (T-011).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render } from '@nuxt/test-utils/browser'
import { registerEndpoint } from '@nuxt/test-utils/runtime'

type Probe = ReturnType<typeof useListQuery<{ id: string }>>

/**
 * Die zuletzt eingehängte Liste.
 *
 * `render` gibt keine Komponenteninstanz heraus, also legt die Komponente sich
 * hier selbst ab.
 */
let current: Probe | undefined

/** Eine Liste ohne Oberfläche: nur das Verhalten, das geprüft wird. */
const ListHost = defineComponent({
  setup() {
    const list = useListQuery<{ id: string }>({
      path: '/api/probe/kunden',
      filters: { kind: '' },
    })
    current = list
    return () => h('div', { 'data-testid': 'list-host' }, String(list.page.value))
  },
})

const answer = () => ({ items: [{ id: 'a' }], total: 300, page: 1, size: 25, pageCount: 12 })

let started = false

/**
 * Hängt eine Liste ein.
 *
 * `registerEndpoint` braucht eine laufende Anwendung, die es erst nach dem
 * ersten `render` gibt — deshalb wird beim allerersten Aufruf zweimal
 * eingehängt.
 */
async function mountList(): Promise<Probe> {
  if (!started) {
    await render(defineComponent({ setup: () => () => h('div') }))
    registerEndpoint('/api/probe/kunden', answer)
    started = true
  }
  current = undefined
  await render(ListHost)
  await new Promise(resolve => setTimeout(resolve, 300))
  if (!current) throw new Error('Die Liste wurde nicht eingehängt.')
  return current
}

const search = () => window.location.search

/** Lässt Entprellung, Anfrage und Navigation durchlaufen. */
const settle = () => new Promise(resolve => setTimeout(resolve, 400))

beforeEach(() => {
  window.history.replaceState({}, '', window.location.pathname)
})

afterEach(() => {
  // Sonst startet der nächste Test im Zustand des vorigen — und genau darum
  // geht es hier gerade.
  window.history.replaceState({}, '', window.location.pathname)
})

describe('Die Adresszeile trägt den Zustand der Liste', () => {
  it('schreibt einen Filterwechsel wirklich in die Adresse', async () => {
    const list = await mountList()
    await list.setFilter('kind', 'firma')
    await settle()

    expect(search()).toContain('kind=firma')
  })

  it('setzt dabei zugleich auf Seite 1', async () => {
    // Seite 7 eines Filters mit vier Treffern zeigt nichts an, und der Nutzer
    // hält die Liste für leer.
    const list = await mountList()
    await list.goToPage(7)
    await settle()
    expect(search()).toContain('page=7')

    await list.setFilter('kind', 'firma')
    await settle()
    expect(search()).toContain('page=1')
  })

  it('schreibt die Seite hinein', async () => {
    const list = await mountList()
    await list.goToPage(4)
    await settle()

    expect(search()).toContain('page=4')
  })

  it('schreibt den Suchbegriff hinein, entprellt', async () => {
    const list = await mountList()
    list.search.value = 'Meier'
    await settle()

    expect(search()).toContain('q=Meier')
  })

  it('hinterlässt einen Eintrag im Verlauf', async () => {
    // Damit der Zurück-Knopf einen Filter zurücknimmt, statt aus der Liste
    // herauszuspringen.
    const list = await mountList()
    await list.setFilter('kind', 'firma')
    await settle()
    expect(search()).toContain('kind=firma')

    window.history.back()
    await settle()
    expect(search()).not.toContain('kind=firma')
  })

  it('räumt die Adresse beim Zurücksetzen wieder auf', async () => {
    const list = await mountList()
    await list.setFilter('kind', 'firma')
    await settle()
    expect(search()).toContain('kind=firma')

    await list.reset()
    await settle()
    expect(search()).toBe('')
  })

  it('lässt eine gefilterte Liste als Adresse weitergeben', async () => {
    // Der eigentliche Zweck: die Adresse ist der Zustand. Wer sie kopiert,
    // gibt die Ansicht weiter — nicht die erste Seite ohne Filter.
    const list = await mountList()
    await list.setFilter('kind', 'firma')
    await list.goToPage(3)
    await settle()

    const parameters = new URLSearchParams(search())
    expect(parameters.get('kind')).toBe('firma')
    expect(parameters.get('page')).toBe('3')
  })
})
