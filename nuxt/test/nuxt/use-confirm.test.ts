/**
 * Der eine Bestätigungsdialog.
 *
 * B-108: der Vorgänger hatte neun selbstgebaute Dialoge, von denen nur drei
 * den Fokus fingen und auf Escape reagierten. Hier gibt es einen, er kommt aus
 * Nuxt UI, und er liefert ein Versprechen — damit steht der Abbruch im Code
 * dort, wo die Handlung steht.
 *
 * Fokusfang, Escape und die Rückgabe des Fokus prüft
 * `test/browser/dialogs.test.ts` in einem echten Chromium. Hier geht es um die
 * Antwort: kommt sie, und stimmt sie.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { DOMWrapper } from '@vue/test-utils'
import { UApp } from '#components'
import { de } from '@nuxt/ui/locale'
import { useConfirm } from '~/composables/useConfirm'
import type { ConfirmOptions } from '~/composables/useConfirm'

const mounted: { unmount: () => void }[] = []

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

const inDialog = (id: string) => document.body.querySelector(`[data-testid="${id}"]`)

const at = (id: string) => {
  const element = inDialog(id)
  if (!element) throw new Error(`Im Dialog gibt es kein „${id}".`)
  return new DOMWrapper(element)
}

/**
 * Wer fragt, muss leben.
 *
 * `useConfirm()` legt den Dialog über `useOverlay()` ab, und gezeigt wird er
 * von `UApp`. Beides braucht eine eingehängte Anwendung — eine Funktion allein
 * hätte keinen Ort, an dem der Dialog erscheinen könnte. `:locale="de"` steht
 * hier wie in `app.vue`: sonst heißt die Schließen-Schaltfläche „Close".
 */
const Asker = defineComponent({
  setup(_props, { expose }) {
    const confirm = useConfirm()
    const answer = ref<boolean | null>(null)

    expose({
      answer,
      ask: (options: ConfirmOptions) => {
        answer.value = null
        void confirm(options).then((value) => {
          answer.value = value
        })
      },
    })

    return () => h('div', { 'data-testid': 'asker' })
  },
})

const Host = defineComponent({
  components: { Asker, UApp },
  setup: () => ({ de }),
  template: '<UApp :locale="de"><Asker /></UApp>',
})

type AskerVm = { answer: boolean | null, ask: (options: ConfirmOptions) => void }

async function asker(): Promise<AskerVm> {
  const wrapper = await mountSuspended(Host)
  mounted.push(wrapper)
  return wrapper.findComponent(Asker).vm as unknown as AskerVm
}

/**
 * Lässt alles zur Ruhe kommen.
 *
 * Die Antwort läuft über ein Versprechen; ohne einen Durchlauf der
 * Ereignisschleife steht sie noch nicht in `answer`.
 */
async function flush(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

/** Stellt die Frage und wartet, bis der Dialog steht. */
async function ask(vm: AskerVm, options: ConfirmOptions): Promise<void> {
  vm.ask(options)
  await flush()
}

describe('useConfirm', () => {
  it('liefert wahr, wenn bestätigt wird', async () => {
    const vm = await asker()
    await ask(vm, { title: 'Kunde archivieren?' })

    await at('confirm-accept').trigger('click')
    await flush()
    expect(vm.answer).toBe(true)
  })

  it('liefert falsch, wenn abgebrochen wird', async () => {
    const vm = await asker()
    await ask(vm, { title: 'Kunde archivieren?' })

    await at('confirm-cancel').trigger('click')
    await flush()
    expect(vm.answer).toBe(false)
  })

  it('liefert falsch, wenn der Dialog ohne Antwort geschlossen wird', async () => {
    // Wegklicken heißt Nein. Ein Dialog, der beim Schließen bestätigt, wäre
    // eine Falle — und der Aufrufer prüft nur auf „wahr".
    const vm = await asker()
    await ask(vm, { title: 'Rechnung stornieren?' })

    const close = document.body.querySelector('[data-slot="close"]')
    await new DOMWrapper(close!).trigger('click')
    await flush()

    expect(vm.answer).toBe(false)
  })

  it('benutzt deutsche Vorgaben für die Schaltflächen', async () => {
    const vm = await asker()
    await ask(vm, { title: 'Wirklich?' })

    expect(at('confirm-accept').text()).toBe('Bestätigen')
    expect(at('confirm-cancel').text()).toBe('Abbrechen')

    await at('confirm-cancel').trigger('click')
    await flush()
  })

  it('spricht auch in den Teilen von Nuxt UI deutsch', async () => {
    // Ohne `:locale="de"` heißt die Schließen-Schaltfläche „Close" — eine
    // englische Beschriftung mitten in einer deutschen Oberfläche.
    const vm = await asker()
    await ask(vm, { title: 'Wirklich?' })

    expect(document.body.querySelector('[data-slot="close"]')?.getAttribute('aria-label'))
      .toBe('Schließen')

    await at('confirm-cancel').trigger('click')
    await flush()
  })

  it('übernimmt eigene Beschriftungen', async () => {
    const vm = await asker()
    await ask(vm, {
      title: 'Rechnung stornieren?',
      confirmLabel: 'Stornieren',
      cancelLabel: 'Zurück',
      tone: 'error',
    })

    expect(at('confirm-accept').text()).toBe('Stornieren')
    expect(at('confirm-cancel').text()).toBe('Zurück')

    await at('confirm-cancel').trigger('click')
    await flush()
  })

  it('zeigt die Erklärung und die Aufzählung', async () => {
    const vm = await asker()
    await ask(vm, {
      title: 'Kunde löschen?',
      description: 'Der Kunde und alles, was an ihm hängt, verschwindet.',
      details: ['3 Fahrzeuge', '7 Rechnungen'],
    })

    expect(at('confirm-description').text())
      .toBe('Der Kunde und alles, was an ihm hängt, verschwindet.')
    expect(at('confirm-details').text()).toContain('3 Fahrzeuge')
    expect(at('confirm-details').text()).toContain('7 Rechnungen')

    await at('confirm-cancel').trigger('click')
    await flush()
  })

  it('lässt weg, wozu es nichts zu sagen gibt', async () => {
    const vm = await asker()
    await ask(vm, { title: 'Wirklich?' })

    expect(inDialog('confirm-details')).toBeNull()
    expect(inDialog('confirm-description')).toBeNull()

    await at('confirm-cancel').trigger('click')
    await flush()
  })

  it('trägt den Titel als Überschrift des Dialogs', async () => {
    // Der Titel ist das, was ein Screenreader als Erstes vorliest. Steht er
    // nicht in der Überschrift des Dialogs, heißt der Dialog „Dialog".
    const vm = await asker()
    await ask(vm, { title: 'Rechnung stornieren?' })

    const content = document.body.querySelector('[role="dialog"]')
    const labelledBy = content?.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent)
      .toContain('Rechnung stornieren?')

    await at('confirm-cancel').trigger('click')
    await flush()
  })

  it('schließt nach der Antwort wieder', async () => {
    const vm = await asker()
    await ask(vm, { title: 'Wirklich?' })
    await at('confirm-accept').trigger('click')
    await flush()
    await nextTick()

    expect(inDialog('confirm-accept')).toBeNull()
  })

  it('lässt sich zweimal hintereinander fragen', async () => {
    const vm = await asker()

    await ask(vm, { title: 'Erste Frage?' })
    await at('confirm-accept').trigger('click')
    await flush()
    expect(vm.answer).toBe(true)

    await ask(vm, { title: 'Zweite Frage?' })
    await at('confirm-cancel').trigger('click')
    await flush()
    expect(vm.answer).toBe(false)
  })
})
