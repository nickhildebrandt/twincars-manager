/**
 * Die Dialoge im echten Chromium.
 *
 * Fokusfang, Escape und die Rückgabe des Fokus lassen sich nur hier prüfen:
 * eine nachgebaute DOM-Umgebung verschiebt keinen Fokus und kennt keine
 * Tabulatorreihenfolge, ein Test dort wäre grün, ohne etwas zu zeigen.
 *
 * B-108: von neun selbstgebauten Dialogen des Vorgängers fingen drei den
 * Fokus, und beim Schließen landete er im Nichts — die Tastaturbedienung
 * begann danach wieder ganz oben auf der Seite.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@nuxt/test-utils/browser'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { userEvent } from 'vitest/browser'
import EntityPicker from '~/components/picker/EntityPicker.vue'
import MultiEntityPicker from '~/components/picker/MultiEntityPicker.vue'

const OPTIONS = [
  { id: 'k-1', label: 'Meier GmbH', sublabel: '89073 Ulm' },
  { id: 'k-2', label: 'Anna Schuster', sublabel: '89231 Neu-Ulm' },
]

/**
 * Hängt einen Picker ein und lässt den Endpoint antworten.
 *
 * `registerEndpoint` geht erst **nach** `render`: es meldet sich bei der
 * Anwendung an, und die gibt es vorher nicht. Zurückgegeben wird genau das,
 * was `server/api/pickers/*` liefern würde — die Serversuche selbst hat ihren
 * eigenen Test gegen eine echte Datenbank.
 */
async function mountPicker(
  component: typeof EntityPicker | typeof MultiEntityPicker,
  props: Record<string, unknown>,
) {
  const screen = await render(component, { props })
  registerEndpoint(String(props.path), () => ({
    items: OPTIONS,
    total: OPTIONS.length,
    page: 1,
    size: 25,
    pageCount: 1,
  }))
  return screen
}

/** Wartet, bis der Dialog samt Ergebnissen steht. */
async function waitFor(selector: string, timeout = 3000): Promise<Element> {
  const until = Date.now() + timeout
  for (;;) {
    const found = document.body.querySelector(selector)
    if (found) return found
    if (Date.now() > until) throw new Error(`„${selector}" ist nicht erschienen.`)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

const gone = async (selector: string, timeout = 3000): Promise<void> => {
  const until = Date.now() + timeout
  while (document.body.querySelector(selector)) {
    if (Date.now() > until) throw new Error(`„${selector}" ist nicht verschwunden.`)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

describe('Der Auswahldialog', () => {
  it('legt den Fokus ins Suchfeld', async () => {
    const screen = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
    })

    await screen.getByTestId('picker-kunde').click()
    const search = await waitFor('[data-testid="picker-search"]')

    // Wer den Dialog öffnet, will suchen. Der Fokus steht dort, wo getippt
    // wird — nicht auf dem Rahmen.
    expect(document.activeElement).toBe(search)
  })

  it('hält den Fokus im Dialog', async () => {
    // Der Sinn eines modalen Dialogs: hinter ihm ist nichts erreichbar.
    const screen = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
    })

    await screen.getByTestId('picker-kunde').click()
    const dialog = await waitFor('[role="dialog"]')
    await waitFor('[data-testid="picker-option-k-1"]')

    for (let step = 0; step < 12; step += 1) {
      await userEvent.keyboard('{Tab}')
      expect(dialog.contains(document.activeElement), `nach ${step + 1} Tabs`).toBe(true)
    }
  })

  it('schließt mit Escape', async () => {
    const screen = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
    })

    await screen.getByTestId('picker-kunde').click()
    await waitFor('[data-testid="picker-search"]')

    await userEvent.keyboard('{Escape}')
    await gone('[data-testid="picker-search"]')
  })

  it('gibt den Fokus an den Auslöser zurück', async () => {
    // Sonst beginnt die Tastaturbedienung nach dem Schließen wieder ganz oben
    // auf der Seite, und der Benutzer sucht seine Stelle (B-108).
    const screen = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
    })

    const trigger = document.body.querySelector('[data-testid="picker-kunde"]')
    await screen.getByTestId('picker-kunde').click()
    await waitFor('[data-testid="picker-search"]')

    await userEvent.keyboard('{Escape}')
    await gone('[data-testid="picker-search"]')

    // Das Zurückgeben passiert eine Zeichnung später.
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(document.activeElement).toBe(trigger)
  })

  it('gibt den Fokus auch nach einer Auswahl zurück', async () => {
    const screen = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
    })

    const trigger = document.body.querySelector('[data-testid="picker-kunde"]')
    await screen.getByTestId('picker-kunde').click()
    const option = await waitFor('[data-testid="picker-option-k-2"]');
    (option as HTMLElement).click()

    await gone('[data-testid="picker-search"]')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(document.activeElement).toBe(trigger)
  })

  it('lässt sich mit der Tastatur bedienen, ohne die Maus zu berühren', async () => {
    const screen = await mountPicker(EntityPicker, {
      path: '/api/pickers/customers',
      entity: 'Kunde',
    })

    const trigger = screen.getByTestId('picker-kunde')
    await trigger.click()
    await waitFor('[data-testid="picker-option-k-1"]')

    // Vom Suchfeld auf den ersten Treffer und dort die Eingabetaste.
    await userEvent.keyboard('{Tab}')
    while (
      document.activeElement
      && !document.activeElement.getAttribute('data-testid')?.startsWith('picker-option-')
    ) {
      await userEvent.keyboard('{Tab}')
    }
    const chosen = document.activeElement?.getAttribute('data-testid')
    await userEvent.keyboard('{Enter}')

    await gone('[data-testid="picker-search"]')
    expect(chosen).toMatch(/^picker-option-/)
  })
})

describe('Der Mehrfachdialog', () => {
  it('fängt den Fokus ebenso', async () => {
    const screen = await mountPicker(MultiEntityPicker, {
      path: '/api/pickers/employees',
      entity: 'Mitarbeiter',
      modelValue: [],
    })

    await screen.getByTestId('multi-picker-mitarbeiter').click()
    const dialog = await waitFor('[role="dialog"]')
    await waitFor('[data-testid="multi-picker-apply"]')

    for (let step = 0; step < 12; step += 1) {
      await userEvent.keyboard('{Tab}')
      expect(dialog.contains(document.activeElement), `nach ${step + 1} Tabs`).toBe(true)
    }
  })

  it('verwirft mit Escape, ohne zu übernehmen', async () => {
    // Escape ist Abbrechen. Ein Dialog, der beim Wegdrücken speichert, macht
    // „Abbrechen" zur Lüge.
    const screen = await mountPicker(MultiEntityPicker, {
      path: '/api/pickers/employees',
      entity: 'Mitarbeiter',
      modelValue: [],
    })

    await screen.getByTestId('multi-picker-mitarbeiter').click()
    const box = await waitFor('[data-testid="multi-picker-option-k-1"]');
    (box as HTMLElement).click()

    await userEvent.keyboard('{Escape}')
    await gone('[data-testid="multi-picker-apply"]')

    expect(screen.getByTestId('multi-picker-mitarbeiter').element().textContent)
      .toContain('Mitarbeiter wählen')
  })
})
