/**
 * Der Rahmen jedes Formulars.
 *
 * Die härteste Zusage steht in [04-ux.md](../../docs/rewrite/04-ux.md)
 * §3.8: **Speichern wird nie wegen fehlender oder ungültiger Eingaben
 * gesperrt.** Ein toter Knopf sagt dem Bediener nicht, was fehlt — eine
 * Fehlerliste schon. Gesperrt wird nur, solange eine Anfrage läuft, und bei
 * einem echten Riegel wie einem ausgestellten Beleg.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FormPage from '~/components/form/FormPage.vue'

/**
 * `attachTo` hängt das Formular ins echte Dokument.
 *
 * Der Sprung von der Fehlerliste zum Feld sucht mit `document.querySelector`.
 * Ohne diese Angabe hängt der Baum daneben, und der Sprung fände nie etwas —
 * der Test wäre grün, ohne etwas zu prüfen.
 */
const mounted: { unmount: () => void }[] = []

async function mount(
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
) {
  const wrapper = await mountSuspended(FormPage, {
    props: { title: 'Kunde bearbeiten', ...props } as never,
    slots: { default: '<input name="lastName" data-testid="feld-nachname">', ...slots },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  useBusyState().value = { count: 0, slow: false }
})

afterEach(() => {
  // Am Dokument angehängt bleiben die Formulare sonst stehen, und der Sprung
  // zum Feld fände das eines früheren Tests.
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('Der Formularrahmen', () => {
  it('zeigt den Titel und die Felder', async () => {
    const wrapper = await mount()
    expect(wrapper.get('h1').text()).toBe('Kunde bearbeiten')
    expect(wrapper.find('[data-testid="feld-nachname"]').exists()).toBe(true)
  })

  it('trägt `novalidate`, damit keine englischen Browserblasen erscheinen', async () => {
    const wrapper = await mount()
    expect(wrapper.get('form').attributes('novalidate')).toBeDefined()
  })

  it('meldet das Speichern beim Absenden', async () => {
    const wrapper = await mount()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('meldet den Abbruch', async () => {
    const wrapper = await mount()
    await wrapper.get('[data-testid="form-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})

describe('Speichern wird nie wegen der Eingaben gesperrt', () => {
  it('B-022: bleibt bei Feldfehlern anklickbar', async () => {
    // Der Kern der Zusage: mit Fehlern speichern zu **dürfen** ist der Weg,
    // auf dem der Bediener erfährt, welche es sind. Beim Vorgänger behaupteten
    // Kommentar und Testtitel das Gegenteil („Submit disabled until valid"),
    // während die Richtlinie genau das verbot.
    const wrapper = await mount({
      errors: { lastName: 'Bitte einen Nachnamen eintragen.' },
    })
    expect(wrapper.get('[data-testid="form-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('sperrt, solange eine Anfrage läuft', async () => {
    const wrapper = await mount()
    useBusyState().value = { count: 1, slow: false }
    await nextTick()

    expect(wrapper.get('[data-testid="form-submit"]').attributes('disabled')).toBeDefined()
  })

  it('sperrt bei einem echten Riegel und sagt warum', async () => {
    const wrapper = await mount({
      locked: true,
      lockedReason: 'Eine ausgestellte Rechnung ist unveränderlich.',
    })
    expect(wrapper.get('[data-testid="form-submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="form-locked"]').text())
      .toContain('Eine ausgestellte Rechnung ist unveränderlich.')
  })
})

describe('Die Fehlerzusammenfassung', () => {
  it('fehlt, solange es nichts zu melden gibt', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-testid="form-errors"]').exists()).toBe(false)
  })

  it('nennt jedes Feld auf Deutsch', async () => {
    const wrapper = await mount({
      errors: {
        lastName: 'Bitte einen Nachnamen eintragen.',
        email: 'Bitte eine gültige E-Mail-Adresse eintragen.',
      },
    })
    const summary = wrapper.get('[data-testid="form-errors"]')
    expect(summary.text()).toContain('Nachname')
    expect(summary.text()).toContain('Bitte einen Nachnamen eintragen.')
    expect(summary.text()).toContain('E-Mail')
  })

  it('benennt auch eine Position in einer Liste', async () => {
    const wrapper = await mount({
      errors: { 'items.2.quantity': 'Bitte eine Menge größer als 0 eintragen.' },
    })
    expect(wrapper.get('[data-testid="form-errors"]').text()).toContain('(Position 3)')
  })

  it('führt vom Eintrag zum Feld', async () => {
    // Eine Liste, die nur aufzählt, hilft bei vierzig Feldern nicht weiter.
    const wrapper = await mount({ errors: { lastName: 'Pflichtfeld.' } })
    const field = wrapper.get('[data-testid="feld-nachname"]').element as HTMLInputElement
    let focused = 0
    field.focus = () => {
      focused += 1
    }
    field.scrollIntoView = () => {}

    await wrapper.get('[data-testid="form-error-lastName"]').trigger('click')
    expect(focused).toBe(1)
  })

  it('kommt mit einem Feld zurecht, das es auf der Seite nicht gibt', async () => {
    const wrapper = await mount({ errors: { gibtsNicht: 'Irgendetwas stimmt nicht.' } })
    await expect(
      wrapper.get('[data-testid="form-error-gibtsNicht"]').trigger('click'),
    ).resolves.not.toThrow()
  })
})

describe('Beschriftungen', () => {
  it('benutzt deutsche Vorgaben', async () => {
    const wrapper = await mount()
    expect(wrapper.get('[data-testid="form-submit"]').text()).toBe('Speichern')
    expect(wrapper.get('[data-testid="form-cancel"]').text()).toBe('Abbrechen')
  })

  it('nimmt eigene an', async () => {
    const wrapper = await mount({ submitLabel: 'Anlegen', cancelLabel: 'Verwerfen' })
    expect(wrapper.get('[data-testid="form-submit"]').text()).toBe('Anlegen')
    expect(wrapper.get('[data-testid="form-cancel"]').text()).toBe('Verwerfen')
  })

  it('nimmt Aktionen neben dem Titel entgegen', async () => {
    const wrapper = await mount({}, { actions: '<button data-testid="loeschen">Löschen</button>' })
    expect(wrapper.find('[data-testid="loeschen"]').exists()).toBe(true)
  })

  it('macht aus „Abbrechen" einen Verweis, wenn ein Ziel genannt ist', async () => {
    const wrapper = await mount({ cancelTo: '/customers' })
    expect(wrapper.get('[data-testid="form-cancel"]').attributes('href')).toBe('/customers')
  })
})
