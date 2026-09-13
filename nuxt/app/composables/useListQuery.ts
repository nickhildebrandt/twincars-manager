/**
 * Das Listenmuster — einmal, für jede Liste der Anwendung.
 *
 * Filter und Seite stehen **in der Adresszeile**. Damit überlebt ein Lesezeichen
 * den Tab, ein Neuladen zeigt dieselbe Ansicht, und der Zurück-Knopf tut das
 * Erwartete. Der Vorgänger hielt sie im Speicher; wer eine Liste teilen wollte,
 * teilte die erste Seite.
 *
 * Drei Dinge, die hier gelöst sind, weil sie sonst in jeder Liste neu
 * schiefgehen:
 *
 *   - **Ein Filterwechsel setzt auf Seite 1.** Sonst zeigt Seite 7 eines
 *     Filters mit vier Treffern nichts an, und der Nutzer hält die Liste für
 *     leer.
 *   - **Das vorige Ergebnis bleibt stehen**, während das neue lädt. Eine
 *     Tabelle, die bei jedem Tastendruck leer blinkt, ist unbenutzbar.
 *   - **Antworten kommen in der Reihenfolge an, in der sie gebraucht werden.**
 *     Eine langsame ältere Antwort darf eine neuere nicht überschreiben — das
 *     erzeugte beim Vorgänger Trefferlisten, die nicht zur Eingabe passten
 *     (B-109).
 */
import type { ListResult } from '#shared/schemas/pagination'
import { PAGE_SIZE } from '#shared/schemas/pagination'

/** Wie lange nach dem letzten Tastendruck gewartet wird. */
export const SEARCH_DEBOUNCE_MS = 250

type Filters = Record<string, string | undefined>

export type ListQueryOptions<T> = {
  /** Woher die Daten kommen, z. B. `/api/customers`. */
  path: string
  /** Zusätzliche Filter mit ihrem Standardwert. Leerer Wert heißt „nicht gesetzt". */
  filters?: Filters
  /** Voreingestellte Sortierspalte. */
  sort?: string
  dir?: 'asc' | 'desc'
  /** Wird nach jedem erfolgreichen Laden aufgerufen. */
  onLoaded?: (result: ListResult<T>) => void
}

/** Entfernt leere Werte, damit die Adresszeile nur zeigt, was gesetzt ist. */
const clean = (values: Record<string, unknown>): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = String(value)
  }
  return out
}

export function useListQuery<T>(options: ListQueryOptions<T>) {
  const route = useRoute()
  const router = useRouter()
  const api = useApi()

  const defaults: Filters = { ...options.filters }

  /** Der Suchbegriff im Feld — er läuft der Adresszeile um die Entprellung voraus. */
  const search = ref(String(route.query.q ?? ''))

  const page = computed(() => {
    const raw = Number(route.query.page ?? 1)
    return Number.isInteger(raw) && raw >= 1 ? raw : 1
  })

  const filters = computed<Filters>(() => {
    const out: Filters = {}
    for (const key of Object.keys(defaults)) {
      out[key] = (route.query[key] as string | undefined) ?? defaults[key]
    }
    return out
  })

  const query = computed(() => clean({
    page: page.value,
    q: route.query.q,
    sort: route.query.sort ?? options.sort,
    dir: route.query.dir ?? options.dir,
    ...filters.value,
  }))

  /** Das zuletzt geladene Ergebnis. Bleibt stehen, während das nächste lädt. */
  const result = ref<ListResult<T> | null>(null) as Ref<ListResult<T> | null>
  const pending = ref(false)
  const failed = ref(false)

  /**
   * Nur die jüngste Anfrage darf schreiben.
   *
   * Ohne diesen Zähler überschreibt eine langsame ältere Antwort eine neuere,
   * und die Liste zeigt das Ergebnis einer Eingabe, die der Nutzer längst
   * überschrieben hat.
   */
  let generation = 0

  async function load(): Promise<void> {
    const mine = ++generation
    pending.value = true
    failed.value = false
    try {
      const loaded = await api.get<ListResult<T>>(options.path, { query: query.value })
      if (mine !== generation) return
      result.value = loaded
      options.onLoaded?.(loaded)
    }
    catch {
      // `useApi` hat den deutschen Satz bereits gezeigt. Hier bleibt nur, die
      // Liste als fehlgeschlagen zu markieren — das vorige Ergebnis bleibt
      // sichtbar, statt die Seite zu leeren.
      if (mine === generation) failed.value = true
    }
    finally {
      if (mine === generation) pending.value = false
    }
  }

  /** Schreibt in die Adresszeile. Alles andere folgt daraus. */
  async function apply(changes: Record<string, unknown>, keepPage = false): Promise<void> {
    const next = clean({
      ...route.query,
      ...changes,
      // Jede Änderung außer dem Blättern beginnt wieder bei eins.
      page: keepPage ? (changes.page ?? route.query.page) : 1,
    })
    await router.push({ query: next })
  }

  /** Blättern. Die einzige Änderung, die die Seite nicht zurücksetzt. */
  const goToPage = (to: number) => apply({ page: Math.max(1, Math.trunc(to)) }, true)

  /** Einen Filter setzen oder mit `undefined` entfernen. */
  const setFilter = (key: string, value: string | undefined) => apply({ [key]: value })

  /** Sortierung wechseln; zweimal dieselbe Spalte dreht die Richtung. */
  function sortBy(column: string): Promise<void> {
    const same = (route.query.sort ?? options.sort) === column
    const next = same && (route.query.dir ?? options.dir) === 'asc' ? 'desc' : 'asc'
    return apply({ sort: column, dir: next })
  }

  /** Alles zurück auf Anfang. */
  async function reset(): Promise<void> {
    search.value = ''
    await router.push({ query: {} })
  }

  // Tippen wird entprellt — immer, nicht nur wenn zufällig jemand zuhört.
  // Beim Vorgänger hing das Verhalten daran, ob ein Rückruf übergeben wurde,
  // sodass dieselbe Komponente zwei Bedeutungen hatte (B-114).
  let debounce: ReturnType<typeof setTimeout> | undefined
  watch(search, (value) => {
    if (debounce !== undefined) clearTimeout(debounce)
    debounce = setTimeout(() => {
      if (value === (route.query.q ?? '')) return
      void apply({ q: value })
    }, SEARCH_DEBOUNCE_MS)
  })
  onScopeDispose(() => {
    if (debounce !== undefined) clearTimeout(debounce)
  })

  // Die Adresszeile ist die Wahrheit: ändert sie sich, wird geladen.
  watch(query, () => void load(), { immediate: true, deep: true })
  watch(() => route.query.q, (value) => {
    search.value = String(value ?? '')
  })

  return {
    search,
    page,
    filters,
    query,
    result: computed(() => result.value),
    items: computed(() => result.value?.items ?? []),
    total: computed(() => result.value?.total ?? 0),
    pageCount: computed(() => result.value?.pageCount ?? 1),
    pageSize: PAGE_SIZE,
    pending: computed(() => pending.value),
    failed: computed(() => failed.value),
    /** Wahr, solange noch nie etwas geladen wurde — dafür ist der Leerzustand. */
    empty: computed(() => result.value !== null && result.value.items.length === 0),
    load,
    apply,
    goToPage,
    setFilter,
    sortBy,
    reset,
  }
}
