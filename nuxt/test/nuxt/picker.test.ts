/**
 * Die Auswahlen.
 *
 * Beim Vorgänger waren sie die fehleranfälligste Stelle der Oberfläche: eine
 * langsame Antwort überschrieb eine neuere (B-109), ein 403 endete als leerer
 * Dialog ohne Erklärung (B-113), das Suchfeld hatte nur einen Platzhalter und
 * keinen Namen (B-093), und der Auslöser las sich für einen Screenreader mit
 * der Feldbeschriftung zusammen (B-096).
 *
 * Geprüft wird hier die Mechanik. Fokusfang, Escape und Fokusrückgabe gehören
 * in einen echten Browser und stehen in `test/browser/picker-dialog.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { DOMWrapper } from '@vue/test-utils'
import EntityPicker from '~/components/picker/EntityPicker.vue'
import MultiEntityPicker from '~/components/picker/MultiEntityPicker.vue'
import { SEARCH_DEBOUNCE_MS } from '~/composables/useListQuery'
import type { PickerOption } from '#shared/picker-labels'

const calls: { path: string, query: Record<string, unknown> }[] = []
let respond: (query: Record<string, unknown>) => Promise<unknown>

mockNuxtImport('useApi', () => () => ({
  get: async (path: string, options?: { query?: Record<string, unknown> }) => {
    const query = options?.query ?? {}
    calls.push({ path, query })
    return respond(query)
  },
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}))

const OPTIONS: PickerOption[] = [
  { id: 'k-1', label: 'Meier GmbH', sublabel: '89073 Ulm' },
  { id: 'k-2', label: 'Anna Schuster', sublabel: '89231 Neu-Ulm' },
]

const page = (items: PickerOption[], total = items.length, size = 25) => ({
  items,
  total,
  page: 1,
  size,
  pageCount: Math.max(1, Math.ceil(total / size)),
})

const mounted: { unmount: () => void }[] = []

beforeEach(() => {
  vi.useFakeTimers()
  calls.length = 0
  respond = async () => page(OPTIONS)
})

afterEach(() => {
  // Der Dialog hängt am Dokument, nicht an der Komponente. Ohne Abbau sieht
  // der nächste Test den Dialog des vorigen.
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  vi.useRealTimers()
})

/** Lässt Entprellung und Anfrage durchlaufen. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10)
  await nextTick()
  await nextTick()
}

/**
 * Der Dialoginhalt liegt nicht im Baum der Komponente.
 *
 * Nuxt UI hängt ihn ans Ende des Dokuments — genau deshalb legt er sich über
 * alles und fängt den Fokus. Gesucht wird deshalb im Dokument; ein
 * `wrapper.find` fände hier nie etwas, und der Test wäre stumm grün.
 */
const inDialog = (id: string): Element | null =>
  document.body.querySelector(`[data-testid="${id}"]`)

const at = (id: string): DOMWrapper<Element> => {
  const element = inDialog(id)
  if (!element) throw new Error(`Im Dialog gibt es kein „${id}".`)
  return new DOMWrapper(element)
}

const dialogText = () => document.body.textContent ?? ''

/** Hängt einen Picker ein und öffnet ihn. */
async function mountPicker(
  component: typeof EntityPicker | typeof MultiEntityPicker,
  props: Record<string, unknown>,
) {
  const wrapper = await mountSuspended(component, { props: props as never })
  mounted.push(wrapper)
  return wrapper
}

describe('EntityPicker', () => {
  const open = async (props: Record<string, unknown> = {}) => {
    const wrapper = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
      ...props,
    })
    const entity = String(props.entity ?? 'Kunde').toLowerCase()
    await wrapper.get(`[data-testid="picker-${entity}"]`).trigger('click')
    await settle()
    return wrapper
  }

  it('B-096: der Auslöser trägt seinen eigenen Namen', async () => {
    const wrapper = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
    })
    expect(wrapper.get('[data-testid="picker-kunde"]').attributes('aria-label'))
      .toBe('Kunde wählen')
  })

  it('nennt im Namen des Auslösers auch die getroffene Wahl', async () => {
    const wrapper = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
      display: 'Meier GmbH',
    })
    expect(wrapper.get('[data-testid="picker-kunde"]').attributes('aria-label'))
      .toBe('Kunde: Meier GmbH. Ändern')
  })

  it('lädt nichts, solange der Dialog zu ist', async () => {
    await mountPicker(EntityPicker, { path: '/api/pickers/customers', entity: 'Kunde' })
    await settle()
    expect(calls).toHaveLength(0)
  })

  it('sucht auf dem Server, sobald der Dialog aufgeht', async () => {
    await open()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.path).toBe('/api/pickers/customers')
    expect(calls[0]?.query).toMatchObject({ page: 1 })
    expect(dialogText()).toContain('Meier GmbH')
  })

  it('behält seinen Titel für den Screenreader', async () => {
    // Ein eigener Kopfbereich hatte den Titel von Nuxt UI verdrängt; die
    // Beschriftung des Dialogs zeigte danach ins Leere.
    await open()
    const content = document.body.querySelector('[role="dialog"]')
    const labelledBy = content?.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toContain('Kunde wählen')
  })

  it('B-093: das Suchfeld hat eine Beschriftung, nicht nur einen Platzhalter', async () => {
    await open()
    const id = at('picker-search').attributes('id')
    expect(id).toBeTruthy()

    const label = document.body.querySelector(`label[for="${id}"]`)
    expect(label?.textContent?.trim()).toBe('Kunde suchen')
  })

  it('reicht zusätzliche Einschränkungen an den Server weiter', async () => {
    await open({ path: '/api/pickers/vehicles', entity: 'Fahrzeug', params: { scope: 'kunde', customerId: 'k-1' } })
    expect(calls[0]?.query).toMatchObject({ scope: 'kunde', customerId: 'k-1' })
  })

  it('übernimmt die Wahl und schließt', async () => {
    const wrapper = await open({ modelValue: null })

    await at('picker-option-k-2').trigger('click')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['k-2'])
    expect(inDialog('picker-search')).toBeNull()
  })

  it('lässt die Wahl wieder entfernen', async () => {
    const wrapper = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
      modelValue: 'k-1',
      display: 'Meier GmbH',
    })
    await wrapper.get('[data-testid="picker-clear"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('zeigt keinen Entfernen-Knopf, wenn nichts gewählt ist', async () => {
    const wrapper = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
    })
    expect(wrapper.find('[data-testid="picker-clear"]').exists()).toBe(false)
  })

  it('B-113: sagt, wenn die Suche fehlgeschlagen ist', async () => {
    // Ohne Behandlung sah der Nutzer einen leeren Dialog und hielt ihn für
    // eine leere Datenbank.
    respond = async () => {
      throw new Error('403')
    }
    await open()
    expect(at('picker-error').text())
      .toBe('Die Suche ist fehlgeschlagen. Bitte versuchen Sie es erneut.')
  })

  it('unterscheidet „nichts gefunden" von „nicht geladen"', async () => {
    respond = async () => page([])
    await open()
    expect(at('picker-empty').text()).toBe('Kein Kunde gefunden.')
    expect(inDialog('picker-error')).toBeNull()
  })

  it('B-114: entprellt die Eingabe', async () => {
    await open()
    calls.length = 0

    const input = at('picker-search')
    await input.setValue('M')
    await input.setValue('Me')
    await input.setValue('Mei')
    await nextTick()
    expect(calls).toHaveLength(0)

    await settle()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.query.q).toBe('Mei')
  })

  it('B-109: eine verspätete Antwort überschreibt die neuere nicht', async () => {
    await open()

    const gates: (() => void)[] = []
    respond = async (query) => {
      await new Promise<void>(resolve => gates.push(resolve))
      return page([{ id: 'x', label: `Treffer zu ${String(query.q ?? '')}` }])
    }

    const input = at('picker-search')
    await input.setValue('alt')
    await settle()
    await input.setValue('neu')
    await settle()

    expect(gates).toHaveLength(2)
    gates[1]!()
    await settle()
    gates[0]!()
    await settle()

    expect(dialogText()).toContain('Treffer zu neu')
    expect(dialogText()).not.toContain('Treffer zu alt')
  })

  it('zeigt „Neu anlegen" nur, wenn es einen Weg dorthin gibt', async () => {
    await open()
    expect(inDialog('picker-create')).toBeNull()
  })

  it('führt aus dem Dialog heraus zum Anlegen', async () => {
    const onCreate = vi.fn()
    await open({ onCreate })

    await at('picker-create').trigger('click')
    await nextTick()

    expect(onCreate).toHaveBeenCalledOnce()
    // Der Dialog geht dabei zu: die Seite wechselt, er dürfte nicht offen
    // stehen bleiben.
    expect(inDialog('picker-search')).toBeNull()
  })

  it('blättert nur, wenn es mehr als eine Seite gibt', async () => {
    respond = async () => page(OPTIONS, 2)
    await open()
    expect(inDialog('picker-pagination')).toBeNull()
  })

  it('blättert bei mehr als einer Seite', async () => {
    respond = async () => page(OPTIONS, 300)
    await open()
    expect(inDialog('picker-pagination')).not.toBeNull()
  })

  it('lädt beim Blättern die nächste Seite vom Server', async () => {
    respond = async query => page(
      [{ id: `seite-${String(query.page)}`, label: `Seite ${String(query.page)}` }],
      300,
    )
    await open()
    expect(dialogText()).toContain('Seite 1')

    const next = [...document.body.querySelectorAll('[data-testid="picker-pagination"] button')]
      .find(button => (button.textContent ?? '').trim() === '2')
    await new DOMWrapper(next!).trigger('click')
    await settle()

    expect(calls.at(-1)?.query.page).toBe(2)
    expect(dialogText()).toContain('Seite 2')
  })

  it('lässt sich sperren', async () => {
    const wrapper = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
      modelValue: 'k-1',
      display: 'Meier GmbH',
      disabled: true,
    })
    expect(wrapper.get('[data-testid="picker-kunde"]').attributes('disabled')).toBeDefined()
    // Gesperrt gibt es auch nichts zu entfernen.
    expect(wrapper.find('[data-testid="picker-clear"]').exists()).toBe(false)
  })

  it('zeigt einen Treffer ohne Unterzeile ohne leere Zeile', async () => {
    respond = async () => page([{ id: 'k-9', label: 'Nur ein Name' }])
    await open()
    expect(at('picker-option-k-9').findAll('span')).toHaveLength(1)
  })

  it('hebt den bereits Gewählten hervor', async () => {
    await open({ modelValue: 'k-2' })
    expect(at('picker-option-k-2').classes()).toContain('bg-elevated')
    expect(at('picker-option-k-1').classes()).not.toContain('bg-elevated')
  })
})

describe('MultiEntityPicker', () => {
  const open = async (props: Record<string, unknown> = {}) => {
    const wrapper = await mountPicker(MultiEntityPicker, {
      path: '/api/pickers/employees',
      entity: 'Mitarbeiter',
      modelValue: [],
      ...props,
    })
    await wrapper.get('[data-testid="multi-picker-mitarbeiter"]').trigger('click')
    await settle()
    return wrapper
  }

  /** Ein Häkchen umlegen. Das Kästchen selbst trägt die Kennung. */
  const check = async (id: string) => {
    await at(`multi-picker-option-${id}`).trigger('click')
    await nextTick()
  }

  it('überträgt erst mit „Übernehmen"', async () => {
    const wrapper = await open()

    await check('k-1')
    // Noch nichts nach außen gegeben: der Dialog ist ein Zwischenstand.
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await at('multi-picker-apply').trigger('click')
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['k-1']])
  })

  it('verwirft bei „Abbrechen"', async () => {
    const wrapper = await open()

    await check('k-1')
    await check('k-2')

    await at('multi-picker-cancel').trigger('click')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('[data-testid="multi-picker-mitarbeiter"]').text())
      .toContain('Mitarbeiter wählen')
  })

  it('beginnt beim Öffnen wieder beim gespeicherten Stand', async () => {
    await open({ modelValue: ['k-2'], display: ['Anna Schuster'] })
    expect(at('multi-picker-apply').text()).toContain('(1)')
  })

  it('zählt im Knopf mit, was angehakt ist', async () => {
    await open()
    expect(at('multi-picker-apply').text()).toContain('(0)')

    await check('k-1')
    expect(at('multi-picker-apply').text()).toContain('(1)')
  })

  it('nimmt ein Häkchen auch wieder zurück', async () => {
    await open()
    await check('k-1')
    expect(at('multi-picker-apply').text()).toContain('(1)')

    await check('k-1')
    expect(at('multi-picker-apply').text()).toContain('(0)')
  })

  it('fasst viele Ausgewählte lesbar zusammen', async () => {
    const wrapper = await mountPicker(MultiEntityPicker, {
      path: '/api/pickers/employees',
      entity: 'Mitarbeiter',
      modelValue: ['a', 'b', 'c', 'd'],
      display: ['Anna', 'Bernd', 'Clara', 'Dieter'],
    })
    expect(wrapper.get('[data-testid="multi-picker-mitarbeiter"]').text())
      .toContain('Anna, Bernd und 2 weitere')
  })

  it('zählt im Namen des Auslösers, wie viele gewählt sind', async () => {
    const wrapper = await mountPicker(MultiEntityPicker, {
      path: '/api/pickers/employees',
      entity: 'Mitarbeiter',
      modelValue: ['a', 'b'],
      display: ['Anna', 'Bernd'],
    })
    expect(wrapper.get('[data-testid="multi-picker-mitarbeiter"]').attributes('aria-label'))
      .toBe('Mitarbeiter wählen, 2 ausgewählt')
  })

  it('sagt auch hier, wenn die Suche fehlgeschlagen ist', async () => {
    respond = async () => {
      throw new Error('500')
    }
    await open()
    expect(inDialog('multi-picker-error')).not.toBeNull()
  })

  it('sucht auf dem Server und entprellt dabei', async () => {
    await open()
    calls.length = 0

    const input = at('multi-picker-search')
    await input.setValue('Schu')
    await nextTick()
    expect(calls).toHaveLength(0)

    await settle()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.query.q).toBe('Schu')
  })

  it('reicht zusätzliche Einschränkungen weiter', async () => {
    await open({ params: { orderId: 'a-1' } })
    expect(calls[0]?.query).toMatchObject({ orderId: 'a-1' })
  })

  it('blättert erst ab zwei Seiten', async () => {
    respond = async () => page(OPTIONS, 2)
    await open()
    expect(document.body.querySelector('nav')).toBeNull()
  })

  it('lädt beim Blättern die nächste Seite vom Server', async () => {
    respond = async query => page(
      [{ id: `seite-${String(query.page)}`, label: `Seite ${String(query.page)}` }],
      300,
    )
    await open()
    expect(dialogText()).toContain('Seite 1')

    const next = [...document.body.querySelectorAll('nav button')]
      .find(button => (button.textContent ?? '').trim() === '2')
    await new DOMWrapper(next!).trigger('click')
    await settle()

    expect(calls.at(-1)?.query.page).toBe(2)
    expect(dialogText()).toContain('Seite 2')
  })

  it('lässt sich sperren', async () => {
    const wrapper = await mountPicker(MultiEntityPicker, {
      path: '/api/pickers/employees',
      entity: 'Mitarbeiter',
      modelValue: [],
      disabled: true,
    })
    const trigger = wrapper.get('[data-testid="multi-picker-mitarbeiter"]')
    expect(trigger.attributes('disabled')).toBeDefined()
  })

  it('zeigt eine einzelne Wahl unverkürzt', async () => {
    const wrapper = await mountPicker(MultiEntityPicker, {
      path: '/api/pickers/employees',
      entity: 'Mitarbeiter',
      modelValue: ['a'],
      display: ['Anna Schuster'],
    })
    expect(wrapper.get('[data-testid="multi-picker-mitarbeiter"]').text())
      .toContain('Anna Schuster')
  })
})
