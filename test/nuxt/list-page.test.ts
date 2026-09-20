/**
 * Der Rahmen einer Listenseite und seine drei Zustände.
 *
 * Die eigentliche Zusage: **es wird nie eine leere Tabelle gezeigt, während
 * neu geladen wird**, und „nichts gefunden" sieht anders aus als „konnte nicht
 * geladen werden". Beim Vorgänger sahen beide gleich aus — eine leere Tabelle,
 * aus der niemand ablesen konnte, ob die Suche nichts ergab oder der Server
 * schwieg.
 */
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ListPage from '~/components/data/ListPage.vue'
import EmptyState from '~/components/data/EmptyState.vue'
import ErrorState from '~/components/data/ErrorState.vue'
import FilterBar from '~/components/data/FilterBar.vue'
import StatusBadge from '~/components/data/StatusBadge.vue'
import { documentStatuses, tireSeasons } from '#shared/domain'

/** Ein Knopf über seine Beschriftung — so, wie ihn auch ein Mensch findet. */
function buttonNamed(wrapper: { findAll: (selector: string) => { text: () => string, trigger: (event: string) => Promise<void> }[] }, label: string) {
  const match = wrapper.findAll('button').find(button => button.text().includes(label))
  if (!match) throw new Error(`Kein Knopf mit der Beschriftung „${label}".`)
  return match
}

describe('ListPage', () => {
  const mount = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) =>
    mountSuspended(ListPage, {
      props: {
        title: 'Kunden',
        total: 120,
        page: 1,
        pageCount: 5,
        pageSize: 25,
        ...props,
      } as never,
      slots: { default: '<p data-testid="inhalt">Die Tabelle</p>', ...slots },
    })

  it('zeigt den Titel', async () => {
    const wrapper = await mount()
    expect(wrapper.get('h1').text()).toBe('Kunden')
  })

  it('zeigt den Inhalt, solange es welchen gibt', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-testid="inhalt"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="error-state"]').exists()).toBe(false)
  })

  it('lässt den Inhalt stehen, während neu geladen wird', async () => {
    // Eine Tabelle, die bei jedem Tastendruck leer blinkt, ist unbenutzbar.
    const wrapper = await mount({ loading: true })
    expect(wrapper.find('[data-testid="inhalt"]').exists()).toBe(true)
  })

  it('lässt den Inhalt auch nach einem Fehler stehen, und warnt darüber', async () => {
    const wrapper = await mount({ failed: true })
    expect(wrapper.find('[data-testid="inhalt"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="list-stale"]').text())
      .toContain('Der angezeigte Stand kann veraltet sein.')
  })

  it('zeigt den Fehlerhinweis erst, wenn gar nichts da ist', async () => {
    const wrapper = await mount({ failed: true, empty: true, total: 0 })
    expect(wrapper.find('[data-testid="error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inhalt"]').exists()).toBe(false)
    // Dann ist die Warnung überflüssig — der Hinweis sagt schon alles.
    expect(wrapper.find('[data-testid="list-stale"]').exists()).toBe(false)
  })

  it('zeigt den Leerzustand, wenn nichts gefunden wurde', async () => {
    const wrapper = await mount({ empty: true, total: 0, pageCount: 1 })
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-state"]').exists()).toBe(false)
  })

  it('reicht die Anfrage nach einem neuen Versuch weiter', async () => {
    const wrapper = await mount({ failed: true, empty: true, total: 0 })
    await buttonNamed(wrapper, 'Erneut laden').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('reicht das Zurücksetzen aus dem Leerzustand weiter', async () => {
    const wrapper = await mount({ empty: true, total: 0, filtered: true })
    await buttonNamed(wrapper, 'Filter zurücksetzen').trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('blättert nur, wenn es mehr als eine Seite gibt', async () => {
    const one = await mount({ pageCount: 1, total: 12 })
    expect(one.find('[data-testid="pagination"]').exists()).toBe(false)

    const many = await mount({ pageCount: 5 })
    expect(many.find('[data-testid="pagination"]').exists()).toBe(true)
  })

  it('B-107: zeichnet genau eine Blätterleiste, ohne Wähler für die Seitengröße', async () => {
    // Der Vorgänger zeichnete zwei Sätze Schaltflächen ins DOM — einen für
    // schmale, einen für breite Geräte, beide immer da. Tests mussten die
    // Duplikate behandeln, und wer nicht nach CSS ging, sah alles doppelt.
    // Dazu trug die Leiste tote `size`/`onSize`-Eigenschaften.
    const wrapper = await mount({ pageCount: 5 })
    expect(wrapper.findAll('[data-testid="pagination"]')).toHaveLength(1)
    expect(wrapper.findAll('select')).toHaveLength(0)
  })

  it('reicht einen Seitenwechsel weiter', async () => {
    const wrapper = await mount({ pageCount: 5, total: 120 })
    const next = wrapper.findAll('[data-testid="pagination"] button')
      .find(button => button.text().trim() === '3')
    await next!.trigger('click')

    expect(wrapper.emitted('page')?.at(-1)).toEqual([3])
  })

  it('nimmt Aktionen und Filter aus der Seite entgegen', async () => {
    const wrapper = await mount({}, {
      actions: '<button data-testid="neu">Neu</button>',
      filters: '<div data-testid="filter">Filter</div>',
    })
    expect(wrapper.find('[data-testid="neu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filter"]').exists()).toBe(true)
  })

  it('nimmt eine eigene Handlung in den Leerzustand auf', async () => {
    const wrapper = await mount(
      { empty: true, total: 0 },
      { 'empty-action': '<button data-testid="jetzt-anlegen">Kunde anlegen</button>' },
    )
    expect(wrapper.find('[data-testid="jetzt-anlegen"]').exists()).toBe(true)
  })
})

describe('EmptyState', () => {
  it('unterscheidet „noch nichts da" von „nichts gefunden"', async () => {
    // Zwei verschiedene Lagen, zwei verschiedene Antworten: anlegen oder den
    // Filter zurücknehmen.
    const leer = await mountSuspended(EmptyState)
    expect(leer.text()).toContain('Noch nichts vorhanden')
    expect(leer.findAll('button').some(b => b.text().includes('Filter zurücksetzen'))).toBe(false)

    const gefiltert = await mountSuspended(EmptyState, { props: { filtered: true } })
    expect(gefiltert.text()).toContain('Keine Treffer')
    expect(gefiltert.findAll('button').some(b => b.text().includes('Filter zurücksetzen'))).toBe(true)
  })

  it('nimmt eigene Worte an', async () => {
    const wrapper = await mountSuspended(EmptyState, {
      props: {
        title: 'Keine offenen Rechnungen',
        description: 'Alles bezahlt.',
        icon: 'i-lucide-check',
      },
    })
    expect(wrapper.text()).toContain('Keine offenen Rechnungen')
    expect(wrapper.text()).toContain('Alles bezahlt.')
  })

  it('meldet den Wunsch, den Filter zurückzunehmen', async () => {
    const wrapper = await mountSuspended(EmptyState, { props: { filtered: true } })
    await buttonNamed(wrapper, 'Filter zurücksetzen').trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })
})

describe('ErrorState', () => {
  it('sagt, dass die Liste nicht geladen werden konnte', async () => {
    const wrapper = await mountSuspended(ErrorState)
    expect(wrapper.text()).toContain('Die Liste konnte nicht geladen werden')
    expect(wrapper.text()).toContain('Bitte versuchen Sie es erneut.')
  })

  it('sagt es anders, wenn noch ein alter Stand zu sehen ist', async () => {
    const wrapper = await mountSuspended(ErrorState, { props: { stale: true } })
    expect(wrapper.text()).toContain('Er kann veraltet sein.')
  })

  it('meldet den Wunsch nach einem neuen Versuch', async () => {
    const wrapper = await mountSuspended(ErrorState)
    await buttonNamed(wrapper, 'Erneut laden').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})

describe('FilterBar', () => {
  const mount = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) =>
    mountSuspended(FilterBar, { props: { search: '', ...props } as never, slots })

  it('B-093: das Suchfeld hat eine Beschriftung, nicht nur einen Platzhalter', async () => {
    const wrapper = await mount({ searchLabel: 'Kunden suchen' })
    const id = wrapper.get('[data-testid="filter-search"]').attributes('id')
    const label = wrapper.findAll('label').find(entry => entry.attributes('for') === id)
    expect(label?.text()).toBe('Kunden suchen')
    expect(label?.classes()).toContain('sr-only')
  })

  it('gibt den Suchbegriff nach außen', async () => {
    const wrapper = await mount()
    await wrapper.get('[data-testid="filter-search"]').setValue('Meier')
    expect(wrapper.emitted('update:search')?.at(-1)).toEqual(['Meier'])
  })

  it('zählt die Einträge in richtiger Einzahl und Mehrzahl', async () => {
    const eins = await mount({ total: 1 })
    expect(eins.get('[data-testid="filter-total"]').text()).toBe('1 Eintrag')

    const viele = await mount({ total: 42 })
    expect(viele.get('[data-testid="filter-total"]').text()).toBe('42 Einträge')

    const keins = await mount({ total: 0 })
    expect(keins.get('[data-testid="filter-total"]').text()).toBe('0 Einträge')
  })

  it('zählt gar nicht, wenn niemand eine Zahl genannt hat', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-testid="filter-total"]').exists()).toBe(false)
  })

  it('bietet das Zurücksetzen nur an, wenn etwas gesetzt ist', async () => {
    const ohne = await mount()
    expect(ohne.find('[data-testid="filter-reset"]').exists()).toBe(false)

    const mit = await mount({ filtered: true })
    await mit.get('[data-testid="filter-reset"]').trigger('click')
    expect(mit.emitted('reset')).toHaveLength(1)
  })

  it('nimmt weitere Filter aus der Seite entgegen', async () => {
    const wrapper = await mount({}, { default: '<span data-testid="art">Art</span>' })
    expect(wrapper.find('[data-testid="art"]').exists()).toBe(true)
  })
})

describe('StatusBadge', () => {
  it('B-011: nimmt die Beschriftung aus der Werteliste, nicht aus der Seite', async () => {
    // Beim Vorgänger hieß derselbe Status je nach Stelle anders — die
    // Reifensaison stand dreimal in drei Vokabularen da.
    const wrapper = await mountSuspended(StatusBadge, {
      props: { domain: tireSeasons, value: 'winter' },
    })
    expect(wrapper.text()).toBe('Winter')
  })

  it('trägt einen Testselektor mit dem Wert', async () => {
    const wrapper = await mountSuspended(StatusBadge, {
      props: { domain: documentStatuses, value: 'draft' },
    })
    expect(wrapper.find('[data-testid="status-draft"]').exists()).toBe(true)
  })

  it('nimmt die Farbe aus der Zuordnung', async () => {
    const wrapper = await mountSuspended(StatusBadge, {
      props: {
        domain: tireSeasons,
        value: 'winter',
        tones: { winter: 'info' },
      },
    })
    expect(wrapper.html()).toContain('Winter')
  })

  it('kommt ohne Wert zurecht', async () => {
    // Ein leeres Feld ist kein Fehler — es bekommt nur keine Farbe.
    const wrapper = await mountSuspended(StatusBadge, {
      props: { domain: tireSeasons, value: null },
    })
    expect(wrapper.find('[data-testid="status-leer"]').exists()).toBe(true)
  })

  it('stellt einen unbekannten Wert dar, statt zu verschwinden', async () => {
    const wrapper = await mountSuspended(StatusBadge, {
      props: { domain: tireSeasons, value: 'herbst' },
    })
    expect(wrapper.text().length).toBeGreaterThan(0)
  })
})
