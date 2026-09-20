import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { NOTIFY_DURATION } from '~/composables/useNotify'

const { toastAdd, toastClear } = vi.hoisted(() => ({
  toastAdd: vi.fn(),
  toastClear: vi.fn(),
}))

mockNuxtImport('useToast', () => () => ({
  add: toastAdd,
  clear: toastClear,
  remove: vi.fn(),
  update: vi.fn(),
  toasts: [],
}))

const lastCall = () => toastAdd.mock.calls.at(-1)![0] as Record<string, unknown>

describe('useNotify', () => {
  it('zeigt eine Erfolgsmeldung in Grün und kurz', () => {
    useNotify().success('Kunde gespeichert.')
    expect(lastCall()).toMatchObject({
      title: 'Kunde gespeichert.',
      color: 'success',
      duration: NOTIFY_DURATION.success,
    })
  })

  it('lässt eine Fehlermeldung länger stehen als eine Erfolgsmeldung', () => {
    useNotify().error('Kunde konnte nicht gespeichert werden.')
    expect(lastCall().color).toBe('error')
    expect(NOTIFY_DURATION.error).toBeGreaterThan(NOTIFY_DURATION.success)
  })

  it('trägt bei einer Fehlermeldung den Grund als zweite Zeile', () => {
    useNotify().error('Speichern fehlgeschlagen.', {
      description: 'Die Rechnung ist bereits versendet.',
    })
    expect(lastCall().description).toBe('Die Rechnung ist bereits versendet.')
  })

  it('kennt einen Hinweis und eine Warnung mit eigener Dauer', () => {
    const notify = useNotify()
    notify.info('Keine fälligen Erinnerungen gefunden.')
    expect(lastCall()).toMatchObject({ color: 'info', duration: NOTIFY_DURATION.info })
    notify.warning('3 von 12 Empfängern nicht erreicht.')
    expect(lastCall()).toMatchObject({ color: 'warning', duration: NOTIFY_DURATION.warning })
  })

  it('erlaubt eine eigene Dauer, etwa dauerhaft offen', () => {
    useNotify().error('Bitte prüfen.', { duration: 0 })
    expect(lastCall().duration).toBe(0)
  })

  it('gibt jeder Art ein eigenes Symbol', () => {
    const notify = useNotify()
    notify.success('a')
    const success = lastCall().icon
    notify.error('b')
    expect(lastCall().icon).not.toBe(success)
  })

  it('kann alle Meldungen entfernen', () => {
    toastClear.mockClear()
    useNotify().clear()
    expect(toastClear).toHaveBeenCalledTimes(1)
  })
})

describe('Regression', () => {
  it('B-035: ein Fehler unterbricht den Screenreader, eine Bestätigung nicht', () => {
    // Der Vorgänger las alles über `role=status` und `aria-live=polite` vor,
    // auch Fehler. Wer nicht auf den Bildschirm sieht, erfuhr vom
    // fehlgeschlagenen Speichern erst irgendwann später.
    const notify = useNotify()

    notify.error('Speichern fehlgeschlagen.')
    expect(lastCall().type).toBe('foreground')

    notify.warning('Drei von zwölf Empfängern nicht erreicht.')
    expect(lastCall().type).toBe('foreground')

    notify.success('Kunde gespeichert.')
    expect(lastCall().type).toBe('background')

    notify.info('Der Import läuft.')
    expect(lastCall().type).toBe('background')
  })
})
