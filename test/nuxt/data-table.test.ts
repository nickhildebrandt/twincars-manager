/**
 * Die Tabelle, die jede Liste benutzt.
 *
 * Drei Zusagen werden hier festgenagelt: die ganze Zeile öffnet den Datensatz,
 * eine Aktion in der Zeile tut das **nicht**, und auf einem schmalen Gerät
 * wird aus jeder Zeile eine Karte. Dazu die Summenzeile im Fuß und die
 * Sortierung, die der Server macht und nicht der Browser.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import DataTable from '~/components/data/DataTable.vue'
import type { Column } from '~/components/data/DataTable.vue'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

type Row = { id: string, number: string, name: string, total: number, note?: string }

const ROWS: Row[] = [
  { id: 'r-1', number: 'RE-0001', name: 'Meier GmbH', total: 11_900 },
  { id: 'r-2', number: 'RE-0002', name: 'Anna Schuster', total: 4500, note: '' },
]

const COLUMNS: Column<Row>[] = [
  { key: 'number', label: 'Nummer', sortable: true },
  { key: 'name', label: 'Kunde' },
  { key: 'note', label: 'Notiz', secondary: true },
  { key: 'total', label: 'Summe', numeric: true, value: row => `${(row.total / 100).toFixed(2)} €` },
]

const mount = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) =>
  mountSuspended(DataTable, {
    props: { rows: ROWS, columns: COLUMNS, ...props } as never,
    slots,
  })

beforeEach(() => {
  navigate.mockClear()
})

/**
 * Eine Zeile über ihre Position im Tabellenrumpf.
 *
 * Bis zum 20.09.2026 trug jede Zeile ein `data-testid="row-<id>"` aus einem
 * eigenen `<table>`. Mit `UTable` gibt es das nicht mehr — und das ist
 * richtig: `tbody tr` ist HTML und bleibt, ein Markup-Detail eines
 * Fremdpakets nicht.
 */
const rowAt = (wrapper: Awaited<ReturnType<typeof mount>>, index: number) =>
  wrapper.findAll('tbody tr')[index]!

describe('Die Zeile führt zum Datensatz', () => {
  it('öffnet beim Klick auf die Zeile die Detailansicht', async () => {
    const wrapper = await mount({ to: (row: Row) => `/invoices/${row.id}` })
    await rowAt(wrapper, 0).trigger('click')
    expect(navigate).toHaveBeenCalledWith('/invoices/r-1')
  })

  it('ist ohne Ziel nicht anklickbar', async () => {
    const wrapper = await mount()
    await rowAt(wrapper, 0).trigger('click')
    expect(navigate).not.toHaveBeenCalled()
    // Ohne Ziel markiert Nuxt UI die Zeile gar nicht erst als auswählbar.
    expect(rowAt(wrapper, 0).attributes('data-selectable')).toBe('false')
  })

  it('öffnet nichts, wenn eine Aktion in der Zeile gedrückt wird', async () => {
    // Sonst öffnet jeder Druck auf „Löschen" nebenbei die Detailseite.
    const wrapper = await mount(
      { to: (row: Row) => `/invoices/${row.id}` },
      { actions: '<button data-testid="row-action">Löschen</button>' },
    )
    await wrapper.get('[data-testid="data-table"] [data-testid="row-action"]').trigger('click')
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('Die Zellen', () => {
  it('nimmt den Wert unter dem Schlüssel, wenn nichts anderes gesagt ist', async () => {
    const wrapper = await mount()
    expect(rowAt(wrapper, 0).text()).toContain('Meier GmbH')
  })

  it('nimmt die eigene Berechnung, wenn es eine gibt', async () => {
    const wrapper = await mount()
    expect(rowAt(wrapper, 0).text()).toContain('119.00 €')
  })

  it('schreibt einen Gedankenstrich statt einer Lücke', async () => {
    // Eine leere Zelle sieht aus wie ein Fehler. Ein Strich sagt: hier steht
    // nichts, und das ist in Ordnung.
    const wrapper = await mount()
    expect(rowAt(wrapper, 1).text()).toContain('—')
  })

  it('lässt sich eine Zelle von außen ersetzen', async () => {
    const wrapper = await mount({}, {
      'cell-name': '<span data-testid="eigene-zelle">Eigene Darstellung</span>',
    })
    expect(wrapper.get('[data-testid="eigene-zelle"]').text()).toBe('Eigene Darstellung')
  })

  it('stellt Zahlen rechtsbündig', async () => {
    const wrapper = await mount()
    const cells = rowAt(wrapper, 0).findAll('td')
    expect(cells.at(-1)?.classes()).toContain('text-right')
    expect(cells.at(-1)?.classes()).toContain('tabular-nums')
  })
})

describe('Sortieren', () => {
  it('meldet den Wunsch nach außen, statt selbst zu sortieren', async () => {
    // Sortiert wird auf dem Server: der Browser kennt nur 25 von 2000 Zeilen.
    const wrapper = await mount()
    await wrapper.get('[data-testid="sort-number"]').trigger('click')
    expect(wrapper.emitted('sort')?.at(-1)).toEqual(['number'])
  })

  it('bietet nur für die vorgesehenen Spalten eine Sortierung an', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-testid="sort-name"]').exists()).toBe(false)
  })

  it('sagt einem Screenreader, wonach gerade sortiert ist', async () => {
    // `aria-sort` gehört an das `<th>`, und dorthin lässt `UTable` keine
    // eigenen Attribute. Angesagt wird deshalb über den zugänglichen Namen
    // des Knopfes — des Elements, das man drückt, um daran etwas zu ändern.
    const ascending = await mount({ sort: 'number', dir: 'asc' })
    expect(ascending.get('[data-testid="sort-number"]').attributes('aria-label'))
      .toContain('aufsteigend sortiert')

    const descending = await mount({ sort: 'number', dir: 'desc' })
    expect(descending.get('[data-testid="sort-number"]').attributes('aria-label'))
      .toContain('absteigend sortiert')
  })

  it('markiert keine Spalte, nach der nicht sortiert wird', async () => {
    const wrapper = await mount({ sort: 'number', dir: 'asc' })
    // Wonach man nicht sortieren kann, bekommt keinen Knopf — und damit auch
    // keine Ansage, die etwas anderes behauptet.
    expect(wrapper.find('[data-testid="sort-customer"]').exists()).toBe(false)
  })
})

describe('Die Summenzeile', () => {
  it('steht im Fuß, nicht als weitere Zeile', async () => {
    const wrapper = await mount({ totals: { number: 'Summe', total: '164.00 €' } })
    const foot = wrapper.get('tfoot')
    expect(foot.text()).toContain('Summe')
    expect(foot.text()).toContain('164.00 €')
  })

  it('fehlt, wenn es nichts zu summieren gibt', async () => {
    const wrapper = await mount()
    expect(wrapper.find('tfoot').exists()).toBe(false)
  })
})

describe('Auf schmalen Geräten', () => {
  it('gibt es zu jeder Zeile eine Karte', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-testid="card-r-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="card-r-2"]').exists()).toBe(true)
  })

  it('lässt die Nebensächlichkeiten weg', async () => {
    // Acht Spalten auf einem Telefon sind keine Tabelle.
    const wrapper = await mount()
    expect(wrapper.get('[data-testid="card-r-1"]').text()).not.toContain('Notiz')
    expect(wrapper.get('[data-testid="card-r-1"]').text()).toContain('Nummer')
  })

  it('führt die Karte ebenfalls zum Datensatz', async () => {
    const wrapper = await mount({ to: (row: Row) => `/invoices/${row.id}` })
    await wrapper.get('[data-testid="card-r-2"] button').trigger('click')
    expect(navigate).toHaveBeenCalledWith('/invoices/r-2')
  })
})

describe('Zustände', () => {
  it('meldet das Laden über die Tabelle, nicht über einen leeren Rumpf', async () => {
    // Nuxt UI zeigt das Laden **nur sichtbar** — ein Balken in der Kopfzeile,
    // der bei `prefers-reduced-motion` von selbst zu einem ruhigen Puls wird.
    // Einem Screenreader sagt er nichts. Diese Lücke schließt die Anwendung
    // an ihrem eigenen Element.
    const wrapper = await mount({ loading: true })
    expect(wrapper.get('[data-testid="data-table"]').attributes('aria-busy')).toBe('true')

    const ruhig = await mount({ loading: false })
    expect(ruhig.get('[data-testid="data-table"]').attributes('aria-busy')).toBeUndefined()
  })

  it('nennt die Tabelle beim Namen, ohne ihn zu zeigen', async () => {
    const wrapper = await mount({ caption: 'Rechnungen, Seite 1 von 4' })
    const caption = wrapper.get('caption')
    expect(caption.text()).toBe('Rechnungen, Seite 1 von 4')
    expect(caption.classes()).toContain('sr-only')
  })

  it('kommt mit einer leeren Liste zurecht', async () => {
    // `UTable` setzt dann eine einzelne Zeile mit seinem Leertext — besser
    // als ein leerer Rumpf, in dem die Spaltenbreiten zusammenfallen.
    const wrapper = await mount({ rows: [] })
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.html()).toContain('data-slot="empty"')
    expect(wrapper.get('[data-testid="data-cards"]').findAll('li')).toHaveLength(0)
  })
})
