/**
 * Beim Blättern ist zu keinem Zeitpunkt eine leere Tabelle zu sehen.
 *
 * Das lässt sich nur an einer laufenden Seite zeigen: gemessen wird **während**
 * die nächste Seite unterwegs ist, nicht davor und nicht danach. Der Server
 * antwortet hier absichtlich langsam, und zwischen Klick und Antwort wird
 * nachgesehen, was auf dem Bildschirm steht.
 *
 * Beim Vorgänger blinkte die Tabelle bei jedem Blättern und bei jedem
 * Tastendruck leer — auf einem Werkstatt-Tablet über WLAN lange genug, um den
 * Eindruck zu erwecken, die Liste sei leer.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@nuxt/test-utils/browser'
import { registerEndpoint } from '@nuxt/test-utils/runtime'

type Row = { id: string, name: string }

/** Wie lange der Server sich Zeit lässt. */
const DELAY_MS = 400

let started = false

const ListHost = defineComponent({
  setup() {
    const list = useListQuery<Row>({ path: '/api/probe/langsam' })
    return () => h('div', [
      h('button', {
        'data-testid': 'weiter',
        'onClick': () => void list.goToPage(list.page.value + 1),
      }, 'Weiter'),
      h('ul', { 'data-testid': 'zeilen' }, list.items.value.map(row =>
        h('li', { key: row.id }, row.name))),
      h('span', { 'data-testid': 'laeuft' }, String(list.pending.value)),
    ])
  },
})

/**
 * Antwortet verzögert, damit der Zwischenzustand messbar wird.
 *
 * Gezählt wird der wievielte Aufruf es ist, statt die Seitenzahl aus der
 * Anfrage zu lesen: die h3-Helfer gibt es im Browser nicht, und für die Frage
 * „steht noch etwas da" genügt, dass jede Antwort anders aussieht.
 */
let answered = 0

const slowAnswer = async () => {
  answered += 1
  const round = answered
  await new Promise(resolve => setTimeout(resolve, DELAY_MS))
  return {
    items: [{ id: `s${round}-1`, name: `Zeile aus Antwort ${round}` }],
    total: 300,
    page: round,
    size: 25,
    pageCount: 12,
  }
}

async function mountList(): Promise<void> {
  if (!started) {
    await render(defineComponent({ setup: () => () => h('div') }))
    registerEndpoint('/api/probe/langsam', slowAnswer)
    started = true
  }
  await render(ListHost)
  await new Promise(resolve => setTimeout(resolve, DELAY_MS + 200))
}

const rows = () =>
  [...document.body.querySelectorAll('[data-testid="zeilen"] li')].map(li => li.textContent)

const pending = () =>
  [...document.body.querySelectorAll('[data-testid="laeuft"]')].some(el => el.textContent === 'true')

describe('Blättern', () => {
  it('lässt die alten Zeilen stehen, bis die neuen da sind', async () => {
    await mountList()
    const before = rows()
    expect(before).toHaveLength(1)

    const next = document.body.querySelector('[data-testid="weiter"]') as HTMLElement
    next.click()

    // Mitten in der Anfrage: es läuft, und die alte Zeile steht noch da.
    await new Promise(resolve => setTimeout(resolve, DELAY_MS / 2))
    expect(pending(), 'die Anfrage läuft noch').toBe(true)
    expect(rows(), 'währenddessen ist die Tabelle nicht leer').toEqual(before)

    await new Promise(resolve => setTimeout(resolve, DELAY_MS + 300))
    expect(rows()).toHaveLength(1)
    expect(rows()).not.toEqual(before)
    expect(pending()).toBe(false)
  })

  it('zeigt zu keinem Zeitpunkt gar keine Zeile', async () => {
    // Dieselbe Zusage, dichter gemessen: alle 20 ms nachsehen.
    await mountList()

    const next = document.body.querySelector('[data-testid="weiter"]') as HTMLElement
    next.click()

    let emptyAt = -1
    for (let elapsed = 0; elapsed < DELAY_MS + 200; elapsed += 20) {
      if (rows().length === 0) emptyAt = elapsed
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    expect(emptyAt, `leer nach ${emptyAt} ms`).toBe(-1)
  })
})
