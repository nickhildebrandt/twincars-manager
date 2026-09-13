/**
 * Eine einzige Ladeanzeige für die ganze Anwendung.
 *
 * Drei Stufen ([04-ux.md](../../../docs/rewrite/04-ux.md) §3.3):
 *
 *   1. jede laufende Anfrage → dünner Balken oben, die **einzige** Ladeleiste
 *   2. eine angeklickte Aktion → der Knopf zeigt einen Spinner und ist gesperrt
 *   3. Anfrage länger als 250 ms → Sperrfläche über dem Inhalt
 *
 * Der Vorgänger hatte dieselbe Idee und trotzdem lokale `busy`-Flags in
 * einzelnen Seiten, die sich mit der globalen Anzeige überlagerten. Hier gibt
 * es keinen zweiten Zähler: `useBusy()` ist der einzige.
 */

/** Ab dieser Wartezeit erscheint die Sperrfläche. */
export const SLOW_AFTER_MS = 250

type BusyState = {
  /** Wie viele Anfragen gerade laufen. */
  count: number
  /** Läuft eine davon länger als {@link SLOW_AFTER_MS}? */
  slow: boolean
}

export function useBusyState() {
  return useState<BusyState>('busy', () => ({ count: 0, slow: false }))
}

export function useBusy() {
  const state = useBusyState()

  // Dieselbe Leiste, die Nuxt beim Seitenwechsel zeigt. Es gibt genau eine;
  // eine zweite anzulegen wäre ein Regelverstoß, keine Geschmacksfrage.
  const indicator = import.meta.client ? useLoadingIndicator() : undefined

  let slowTimer: ReturnType<typeof setTimeout> | undefined

  function start(): void {
    state.value = { ...state.value, count: state.value.count + 1 }
    if (state.value.count === 1) indicator?.start()
    if (slowTimer !== undefined || !import.meta.client) return
    slowTimer = setTimeout(() => {
      if (state.value.count > 0) state.value = { ...state.value, slow: true }
    }, SLOW_AFTER_MS)
  }

  function finish(): void {
    const count = Math.max(0, state.value.count - 1)
    state.value = { count, slow: count > 0 && state.value.slow }
    if (count > 0) return
    indicator?.finish()
    if (slowTimer !== undefined) {
      clearTimeout(slowTimer)
      slowTimer = undefined
    }
  }

  /**
   * Führt eine Anfrage aus und zählt sie mit.
   *
   * Auch bei einem Fehler wird heruntergezählt — sonst bliebe die Anwendung
   * für den Rest der Sitzung im Ladezustand.
   */
  async function run<T>(work: () => Promise<T>): Promise<T> {
    start()
    try {
      return await work()
    }
    finally {
      finish()
    }
  }

  return {
    /** Stufe 1 und 2: irgendetwas läuft. */
    active: computed(() => state.value.count > 0),
    /** Stufe 3: es dauert. */
    slow: computed(() => state.value.slow),
    count: computed(() => state.value.count),
    run,
    start,
    finish,
  }
}
