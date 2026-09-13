/**
 * Die Warnung vor ungespeicherten Änderungen.
 *
 * B-038: der Vorgänger brach die Navigation ab und steuerte das Ziel nach
 * „Verwerfen" mit einer neuen Navigation an. Beim Browser-Zurück entstand
 * dadurch ein zusätzlicher Vorwärtseintrag im Verlauf, statt zurückzugehen.
 * Hier wird die Navigation schlicht fortgesetzt oder nicht — der Verlauf wird
 * gar nicht angefasst.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { UNSAVED_QUESTION } from '~/composables/useFormDirty'

/** Eine Seite, die den Wächter anhängt — so wie ein echtes Formular. */
const GuardedPage = defineComponent({
  setup() {
    const form = useFormDirty()
    form.guard()
    return () => h('form', 'Formular')
  },
})

const confirmSpy = vi.fn<(message?: string) => boolean>()

beforeEach(() => {
  useDirtyState().value = false
  confirmSpy.mockReset()
  confirmSpy.mockReturnValue(true)
  vi.stubGlobal('confirm', confirmSpy)
})

/**
 * Gemountete Seiten, die nach jedem Test wieder verschwinden.
 *
 * Ohne das blieben die `beforeunload`-Zuhörer früherer Tests hängen und ein
 * späterer Test sähe die Warnung eines anderen — genau die Art Ansammlung, die
 * der Wächter selbst vermeiden soll.
 */
const mounted: { unmount: () => void }[] = []

async function mountGuarded() {
  const page = await mountSuspended(GuardedPage)
  mounted.push(page)
  return page
}

afterEach(() => {
  while (mounted.length > 0) mounted.pop()!.unmount()
  vi.unstubAllGlobals()
})

describe('Der Zustand', () => {
  it('ist am Anfang sauber', () => {
    expect(useFormDirty().isDirty.value).toBe(false)
  })

  it('merkt sich eine Änderung', () => {
    const form = useFormDirty()
    form.markDirty()
    expect(form.isDirty.value).toBe(true)
  })

  it('ist nach dem Speichern wieder sauber', () => {
    const form = useFormDirty()
    form.markDirty()
    form.markSaved()
    expect(form.isDirty.value).toBe(false)
  })

  it('teilt den Zustand über die ganze Anwendung', () => {
    // Ein zweiter Zähler in einer einzelnen Seite wäre genau die Doppelung,
    // die beim Vorgänger dazu führte, dass die Abfrage manchmal ausblieb.
    useFormDirty().markDirty()
    expect(useFormDirty().isDirty.value).toBe(true)
  })
})

describe('confirmLeave', () => {
  it('fragt nicht, wenn nichts zu verlieren ist', () => {
    expect(useFormDirty().confirmLeave()).toBe(true)
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('fragt bei ungespeicherten Änderungen', () => {
    const form = useFormDirty()
    form.markDirty()

    expect(form.confirmLeave()).toBe(true)
    expect(confirmSpy).toHaveBeenCalledWith(UNSAVED_QUESTION)
  })

  it('hält die Navigation an, wenn der Nutzer bleiben will', () => {
    const form = useFormDirty()
    form.markDirty()
    confirmSpy.mockReturnValue(false)

    expect(form.confirmLeave()).toBe(false)
  })

  it('lässt den Zustand geändert, wenn der Nutzer bleibt', () => {
    const form = useFormDirty()
    form.markDirty()
    confirmSpy.mockReturnValue(false)
    form.confirmLeave()

    expect(form.isDirty.value).toBe(true)
  })

  it('fragt auf Deutsch und in einem vollständigen Satz', () => {
    expect(UNSAVED_QUESTION).toMatch(/^Es gibt ungespeicherte Änderungen\. .+\?$/)
  })
})

describe('guard', () => {
  it('hängt sich an die Seite, ohne sie zu verändern', async () => {
    const page = await mountGuarded()
    expect(page.find('form').exists()).toBe(true)
  })

  it('warnt beim Schließen des Tabs, wenn etwas offen ist', async () => {
    await mountGuarded()
    useFormDirty().markDirty()

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('schweigt beim Schließen, wenn nichts offen ist', async () => {
    await mountGuarded()

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('hört auf zu warnen, wenn die Seite verschwindet', async () => {
    const page = await mountGuarded()
    useFormDirty().markDirty()
    page.unmount()
    mounted.pop()

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    // Der Zuhörer wird mit der Seite abgeräumt. Sonst sammelten sich bei
    // jedem Formularwechsel weitere an.
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('Regression', () => {
  it('B-038: nach „Verwerfen" wird die Navigation fortgesetzt, nicht neu gestartet', () => {
    // Der Wächter antwortet nur mit wahr oder falsch. Er ruft weder `goto`
    // noch `history.back()` auf, also kann der Verlauf keinen zusätzlichen
    // Eintrag bekommen — gleichgültig, ob der Nutzer geklickt oder den
    // Zurück-Knopf benutzt hat.
    const form = useFormDirty()
    form.markDirty()
    confirmSpy.mockReturnValue(true)

    const pushState = vi.spyOn(window.history, 'pushState')
    const back = vi.spyOn(window.history, 'back')

    expect(form.confirmLeave()).toBe(true)

    expect(pushState).not.toHaveBeenCalled()
    expect(back).not.toHaveBeenCalled()

    pushState.mockRestore()
    back.mockRestore()
  })
})
