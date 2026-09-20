/**
 * Das Listenmuster.
 *
 * Geprüft wird genau das, was in jeder Liste einzeln schiefgeht, wenn es nicht
 * an einer Stelle steht: eine Seite 7, die nach einem Filterwechsel leer
 * bleibt; eine Tabelle, die bei jedem Tastendruck leer blinkt; eine langsame
 * alte Antwort, die eine neue überschreibt (B-109); ein Suchfeld, das nur
 * manchmal entprellt (B-114); und Filter, die ein Neuladen nicht überleben.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { SEARCH_DEBOUNCE_MS, useListQuery } from '~/composables/useListQuery'
import type { EffectScope } from 'vue'

/**
 * Eine Adresszeile, auf die das Composable wirklich reagiert.
 *
 * Ein einfaches Objekt genügt nicht: `useListQuery` beobachtet `route.query`.
 * Ohne Reaktivität wäre der Test grün, ohne etwas zu prüfen — dieser Fehler
 * ist in diesem Projekt schon einmal vorgekommen.
 */
const { holder } = vi.hoisted(() => ({
  holder: {} as { query?: { value: Record<string, string> }, pushes?: unknown[] },
}))

mockNuxtImport('useRoute', () => {
  holder.query ??= ref({})
  const query = holder.query as Ref<Record<string, string>>
  return () => reactive({ query: computed(() => query.value), path: '/kunden' })
})

/**
 * Ein Router, der nur eines tut: die Adresszeile schreiben.
 *
 * Die übrigen Felder sind Attrappen — die Nuxt-Laufzeit hängt beim Start
 * Beobachter an den Router, und ohne sie startet sie gar nicht erst.
 */
mockNuxtImport('useRouter', () => {
  holder.query ??= ref({})
  holder.pushes ??= []
  const query = holder.query as Ref<Record<string, string>>
  const noop = () => () => {}
  const router = {
    push: async (to: { query: Record<string, string> }) => {
      holder.pushes!.push(to.query)
      // So verhält sich der echte Router: er schreibt die Adresszeile, und
      // alles Weitere folgt daraus.
      query.value = { ...to.query }
      await nextTick()
    },
    replace: async () => {},
    afterEach: noop,
    beforeEach: noop,
    beforeResolve: noop,
    onError: noop,
    isReady: async () => {},
    go: () => {},
    back: () => {},
    forward: () => {},
    resolve: (to: unknown) => ({ fullPath: '/kunden', href: '/kunden', matched: [], to }),
    getRoutes: () => [],
    hasRoute: () => false,
    addRoute: () => () => {},
    removeRoute: () => {},
    currentRoute: computed(() => ({ path: '/kunden', fullPath: '/kunden', query: query.value })),
    options: { routes: [] },
    install: () => {},
  }
  return () => router
})

/** Was `useApi().get` als Nächstes liefert, und was es dabei gefragt wurde. */
const calls: { path: string, query: Record<string, unknown> }[] = []
let respond: (query: Record<string, unknown>) => Promise<unknown> = async () => page([])

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

const page = (items: { id: string }[], total = items.length) => ({
  items,
  total,
  page: 1,
  size: 25,
  pageCount: Math.max(1, Math.ceil(total / 25)),
})

const url = () => holder.query!.value

beforeEach(() => {
  vi.useFakeTimers()
  holder.query!.value = {}
  holder.pushes!.length = 0
  calls.length = 0
  respond = async () => page([{ id: 'a' }])
})

afterEach(() => {
  // Jeder Lauf hinterlässt Beobachter auf der Adresszeile. Bleiben sie
  // stehen, lädt der nächste Test die Listen der vorigen gleich mit.
  for (const scope of scopes.splice(0)) scope.stop()
  vi.useRealTimers()
})

/** Lässt die Entprellung ablaufen und wartet die Anfrage ab. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10)
  await nextTick()
  await nextTick()
}

const scopes: EffectScope[] = []

/** Führt das Composable in einem eigenen Gültigkeitsbereich aus. */
function run<T>(body: () => T): T {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(body)!
}

describe('Die Adresszeile ist die Wahrheit', () => {
  it('lädt beim Einrichten sofort', async () => {
    run(() => useListQuery({ path: '/api/customers' }))
    await settle()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.path).toBe('/api/customers')
  })

  it('liest Seite und Filter aus der Adresszeile', async () => {
    holder.query!.value = { page: '3', kind: 'firma', q: 'Meier' }
    const list = run(() => useListQuery({ path: '/api/customers', filters: { kind: '' } }))
    await settle()

    expect(list.page.value).toBe(3)
    expect(list.filters.value.kind).toBe('firma')
    expect(list.search.value).toBe('Meier')
    expect(calls[0]?.query).toMatchObject({ page: '3', kind: 'firma', q: 'Meier' })
  })

  it('B-149: nimmt eine unsinnige Seitenzahl nicht ernst', async () => {
    // Ein alter Lesezeichen-Link soll die erste Seite zeigen, keinen Fehler.
    holder.query!.value = { page: '-4' }
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()
    expect(list.page.value).toBe(1)
  })

  it('schreibt leere Werte nicht in die Adresszeile', async () => {
    const list = run(() => useListQuery({ path: '/api/customers', filters: { kind: '' } }))
    await settle()

    await list.setFilter('kind', 'firma')
    await settle()
    expect(url().kind).toBe('firma')

    await list.setFilter('kind', undefined)
    await settle()
    expect(url()).not.toHaveProperty('kind')
  })
})

describe('Ein Filterwechsel beginnt wieder bei eins', () => {
  it('setzt beim Filtern auf Seite 1 zurück', async () => {
    holder.query!.value = { page: '7' }
    const list = run(() => useListQuery({ path: '/api/customers', filters: { kind: '' } }))
    await settle()

    await list.setFilter('kind', 'firma')
    await settle()

    expect(url().page).toBe('1')
    expect(list.page.value).toBe(1)
  })

  it('setzt auch beim Sortieren zurück', async () => {
    holder.query!.value = { page: '4' }
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()

    await list.sortBy('name')
    await settle()
    expect(url().page).toBe('1')
    expect(url().sort).toBe('name')
    expect(url().dir).toBe('asc')
  })

  it('dreht beim zweiten Klick auf dieselbe Spalte die Richtung', async () => {
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()

    await list.sortBy('name')
    await settle()
    await list.sortBy('name')
    await settle()
    expect(url().dir).toBe('desc')
  })

  it('behält die Seite genau beim Blättern', async () => {
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()

    await list.goToPage(3)
    await settle()
    expect(url().page).toBe('3')
    expect(list.page.value).toBe(3)
  })

  it('blättert nie vor die erste Seite', async () => {
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()

    await list.goToPage(0)
    await settle()
    expect(list.page.value).toBe(1)
  })
})

describe('Die Suche wird entprellt', () => {
  it('B-114: wartet auch ohne Rückruf', async () => {
    // Beim Vorgänger hing das Entprellen daran, ob jemand einen Rückruf
    // übergab — dieselbe Komponente hatte zwei Bedeutungen.
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()
    calls.length = 0

    list.search.value = 'M'
    list.search.value = 'Me'
    list.search.value = 'Mei'
    await nextTick()
    expect(calls).toHaveLength(0)

    await settle()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.query.q).toBe('Mei')
  })

  it('fragt nicht erneut, wenn sich nichts geändert hat', async () => {
    holder.query!.value = { q: 'Meier' }
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()
    calls.length = 0

    list.search.value = 'Meier'
    await settle()
    expect(calls).toHaveLength(0)
  })
})

describe('Das vorige Ergebnis bleibt stehen', () => {
  it('zeigt weiter die alten Zeilen, während neu geladen wird', async () => {
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()
    expect(list.items.value).toEqual([{ id: 'a' }])

    let release: (() => void) | undefined
    respond = async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return page([{ id: 'b' }])
    }

    void list.goToPage(2)
    await settle()

    // Noch nicht geantwortet: die Tabelle zeigt die alten Zeilen, nicht nichts.
    expect(list.pending.value).toBe(true)
    expect(list.items.value).toEqual([{ id: 'a' }])

    release!()
    await settle()
    expect(list.items.value).toEqual([{ id: 'b' }])
  })

  it('behält die Zeilen auch nach einem Fehler', async () => {
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()

    respond = async () => {
      throw new Error('kaputt')
    }
    await list.goToPage(2)
    await settle()

    expect(list.failed.value).toBe(true)
    expect(list.items.value).toEqual([{ id: 'a' }])
  })
})

describe('B-109: eine alte Antwort überschreibt keine neue', () => {
  it('verwirft die verspätete Antwort', async () => {
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()

    const gates: (() => void)[] = []
    respond = async (query) => {
      await new Promise<void>(resolve => gates.push(resolve))
      return page([{ id: String(query.q ?? '') }])
    }

    // Zwei Anfragen unterwegs. Die erste antwortet als Letzte.
    list.search.value = 'alt'
    await settle()
    list.search.value = 'neu'
    await settle()

    expect(gates).toHaveLength(2)
    gates[1]!()
    await settle()
    gates[0]!()
    await settle()

    expect(list.items.value).toEqual([{ id: 'neu' }])
  })
})

describe('Zurücksetzen', () => {
  it('leert Suchfeld und Adresszeile', async () => {
    holder.query!.value = { q: 'Meier', page: '3', kind: 'firma' }
    const list = run(() => useListQuery({ path: '/api/customers', filters: { kind: '' } }))
    await settle()

    await list.reset()
    await settle()

    expect(list.search.value).toBe('')
    expect(url()).toEqual({})
  })
})

describe('Vor der ersten Antwort', () => {
  it('gibt eine leere, aber benutzbare Liste heraus', async () => {
    // Eine Seite rendert, bevor die erste Antwort da ist. Sie darf dabei nicht
    // über `undefined` stolpern.
    let hold: (() => void) | undefined
    respond = async () => {
      await new Promise<void>((resolve) => {
        hold = resolve
      })
      return page([{ id: 'a' }])
    }

    const list = run(() => useListQuery({ path: '/api/customers' }))
    await nextTick()

    expect(list.result.value).toBeNull()
    expect(list.items.value).toEqual([])
    expect(list.total.value).toBe(0)
    expect(list.pageCount.value).toBe(1)
    expect(list.pageSize).toBe(25)

    hold?.()
    await settle()
  })
})

describe('Sortierung mit Voreinstellung', () => {
  it('dreht die voreingestellte Richtung um, ohne dass sie in der Adresse steht', async () => {
    const list = run(() => useListQuery({ path: '/api/customers', sort: 'name', dir: 'asc' }))
    await settle()
    // In der Adresse steht noch nichts; die Voreinstellung gilt trotzdem.
    expect(url()).not.toHaveProperty('dir')

    await list.sortBy('name')
    await settle()
    expect(url().dir).toBe('desc')
  })

  it('schickt die Voreinstellung an den Server mit', async () => {
    run(() => useListQuery({ path: '/api/customers', sort: 'name', dir: 'desc' }))
    await settle()
    expect(calls[0]?.query).toMatchObject({ sort: 'name', dir: 'desc' })
  })
})

describe('apply', () => {
  it('behält auf Wunsch die Seite, auch ohne sie zu nennen', async () => {
    // Für Änderungen, die die Auswahl nicht verkleinern — etwa eine
    // Spaltenbreite oder ein Anzeigeschalter.
    holder.query!.value = { page: '5' }
    const list = run(() => useListQuery({ path: '/api/customers' }))
    await settle()

    await list.apply({ ansicht: 'karten' }, true)
    await settle()
    expect(url().page).toBe('5')
    expect(url().ansicht).toBe('karten')
  })
})

describe('onLoaded', () => {
  it('meldet jedes geladene Ergebnis', async () => {
    const seen: number[] = []
    const list = run(() => useListQuery<{ id: string }>({
      path: '/api/customers',
      onLoaded: result => seen.push(result.total),
    }))
    await settle()
    expect(seen).toEqual([1])

    await list.goToPage(2)
    await settle()
    expect(seen).toHaveLength(2)
  })
})

describe('Der Leerzustand', () => {
  it('gilt erst, wenn wirklich nichts kam', async () => {
    respond = async () => page([])
    const list = run(() => useListQuery({ path: '/api/customers' }))

    // Vor der ersten Antwort ist die Liste nicht leer, sondern unbekannt.
    expect(list.empty.value).toBe(false)

    await settle()
    expect(list.empty.value).toBe(true)
    expect(list.total.value).toBe(0)
  })
})
