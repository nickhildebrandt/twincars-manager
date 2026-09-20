/**
 * Die Ladeanzeige in der Nuxt-Laufzeit.
 *
 * Verboten sind laut 04-ux.md §3.3 eine zweite Ladeleiste und lokale
 * `busy`-Flags. Hier wird geprüft, dass der Zähler sich richtig verhält —
 * gerade dann, wenn eine Anfrage scheitert.
 */
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { SLOW_AFTER_MS } from '~/composables/useBusy'

const { indicatorStart, indicatorFinish } = vi.hoisted(() => ({
  indicatorStart: vi.fn(),
  indicatorFinish: vi.fn(),
}))

mockNuxtImport('useLoadingIndicator', () => () => ({
  start: indicatorStart,
  finish: indicatorFinish,
  clear: vi.fn(),
  progress: ref(0),
  isLoading: ref(false),
}))

const reset = () => {
  useBusyState().value = { count: 0, slow: false }
  indicatorStart.mockReset()
  indicatorFinish.mockReset()
}

describe('SLOW_AFTER_MS', () => {
  it('steht auf 250 Millisekunden', () => {
    // 04-ux.md §3.3. Kürzer wäre Flackern bei jeder schnellen Antwort.
    expect(SLOW_AFTER_MS).toBe(250)
  })
})

describe('Zählen', () => {
  it('ist am Anfang ruhig', () => {
    reset()
    const busy = useBusy()
    expect(busy.active.value).toBe(false)
    expect(busy.slow.value).toBe(false)
  })

  it('meldet eine laufende Anfrage', async () => {
    reset()
    const busy = useBusy()
    const work = busy.run(() => new Promise(resolve => setTimeout(resolve, 5)))
    expect(busy.active.value).toBe(true)
    await work
    expect(busy.active.value).toBe(false)
  })

  it('zählt parallele Anfragen', () => {
    reset()
    const busy = useBusy()
    busy.start()
    busy.start()
    expect(busy.count.value).toBe(2)

    busy.finish()
    expect(busy.active.value).toBe(true)

    busy.finish()
    expect(busy.active.value).toBe(false)
  })

  it('hört auch bei einem Fehler wieder auf', async () => {
    // Sonst bliebe die Anwendung für den Rest der Sitzung im Ladezustand.
    reset()
    const busy = useBusy()
    await expect(busy.run(() => Promise.reject(new Error('kaputt')))).rejects.toThrow('kaputt')
    expect(busy.active.value).toBe(false)
  })

  it('zählt nicht unter null', () => {
    reset()
    const busy = useBusy()
    busy.finish()
    busy.finish()
    expect(busy.count.value).toBe(0)
  })
})

describe('Die eine Leiste', () => {
  it('startet die Leiste von Nuxt, statt eine zweite anzulegen', () => {
    reset()
    const busy = useBusy()
    busy.start()
    expect(indicatorStart).toHaveBeenCalledTimes(1)
  })

  it('startet sie bei paralleler Arbeit nur einmal', () => {
    reset()
    const busy = useBusy()
    busy.start()
    busy.start()
    expect(indicatorStart).toHaveBeenCalledTimes(1)
  })

  it('beendet sie erst, wenn nichts mehr läuft', () => {
    reset()
    const busy = useBusy()
    busy.start()
    busy.start()
    busy.finish()
    expect(indicatorFinish).not.toHaveBeenCalled()

    busy.finish()
    expect(indicatorFinish).toHaveBeenCalledTimes(1)
  })
})

describe('Stufe drei', () => {
  it('erscheint erst nach der Wartezeit', async () => {
    vi.useFakeTimers()
    try {
      reset()
      const busy = useBusy()
      busy.start()
      expect(busy.slow.value).toBe(false)

      vi.advanceTimersByTime(SLOW_AFTER_MS - 1)
      expect(busy.slow.value).toBe(false)

      vi.advanceTimersByTime(2)
      expect(busy.slow.value).toBe(true)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('erscheint nicht für eine schnelle Anfrage', () => {
    vi.useFakeTimers()
    try {
      reset()
      const busy = useBusy()
      busy.start()
      busy.finish()
      vi.advanceTimersByTime(SLOW_AFTER_MS * 2)
      expect(busy.slow.value).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('verschwindet, wenn die Arbeit endet', () => {
    vi.useFakeTimers()
    try {
      reset()
      const busy = useBusy()
      busy.start()
      vi.advanceTimersByTime(SLOW_AFTER_MS + 1)
      expect(busy.slow.value).toBe(true)

      busy.finish()
      expect(busy.slow.value).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })
})
