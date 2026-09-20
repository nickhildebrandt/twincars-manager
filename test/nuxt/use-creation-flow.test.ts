/**
 * Anlegen, ohne zu verlieren, woran man gerade war.
 *
 * B-111: der Vorgänger legte den Formularstand samt Fotos als Base64 ab,
 * überschritt damit stumm das Speicherlimit des Browsers und fiel auf reinen
 * Arbeitsspeicher zurück. Ein Neuladen verlor dann alles — ohne Hinweis.
 *
 * Geprüft wird: was in den Entwurf kommt, was nicht, wann er verfällt, wie
 * tief die Kette gehen darf, und dass ein volles Speicherlimit eine Meldung
 * ist und kein Schweigen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import {
  DRAFT_MAX_AGE_MS,
  MAX_DEPTH,
  isFresh,
  useCreationFlow,
  withoutBinaries,
} from '~/composables/useCreationFlow'
import type { CreationDraft } from '~/composables/useCreationFlow'

const { warn, navigate } = vi.hoisted(() => ({ warn: vi.fn(), navigate: vi.fn() }))

mockNuxtImport('useNotify', () => () => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: warn,
  info: vi.fn(),
}))

mockNuxtImport('navigateTo', () => navigate)

const STORAGE_KEY = 'tcm:creation-flow'

const stored = (): CreationDraft[] =>
  JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as CreationDraft[]

beforeEach(() => {
  sessionStorage.clear()
  warn.mockClear()
  navigate.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Lässt eine Speicheroperation scheitern, und zwar nur für diesen einen Lauf.
 *
 * Ein Spion auf `sessionStorage` überlebt `restoreAllMocks` in dieser Umgebung
 * und legt dann alle folgenden Tests still lahm — die Wiederherstellung steht
 * deshalb hier und nicht in einem Haken.
 */
function withBrokenStorage<T>(
  method: 'setItem' | 'getItem' | 'removeItem',
  run: () => T,
): T {
  const spy = vi.spyOn(sessionStorage, method).mockImplementation(() => {
    throw new DOMException('QuotaExceededError')
  })
  try {
    return run()
  }
  finally {
    spy.mockRestore()
  }
}

describe('withoutBinaries', () => {
  it('B-111: lässt Felder weg, die groß werden können', () => {
    const cleaned = withoutBinaries({
      lastName: 'Meier',
      photos: ['…'],
      mainImage: 'x',
      attachmentIds: ['a'],
      uploadedFile: 'y',
      fileName: 'z',
    })
    expect(Object.keys(cleaned)).toEqual(['lastName'])
  })

  it('lässt auch einen eingebetteten Datenstrom weg', () => {
    const cleaned = withoutBinaries({
      lastName: 'Meier',
      logo: 'data:image/png;base64,iVBORw0KGgo=',
    })
    expect(cleaned).toEqual({ lastName: 'Meier' })
  })

  it('lässt Blobs und Puffer weg', () => {
    const cleaned = withoutBinaries({
      lastName: 'Meier',
      anhang: new Blob(['x']),
      puffer: new ArrayBuffer(8),
    })
    expect(cleaned).toEqual({ lastName: 'Meier' })
  })

  it('behält alles Gewöhnliche', () => {
    const state = {
      lastName: 'Meier',
      zip: '89073',
      paymentTermDays: 14,
      wantsBroadcast: true,
      birthday: null,
    }
    expect(withoutBinaries(state)).toEqual(state)
  })
})

describe('isFresh', () => {
  const draft = (createdAt: number): CreationDraft => ({
    returnTo: '/orders/new',
    entity: 'Kunde',
    field: 'customerId',
    state: {},
    createdAt,
  })

  it('gilt innerhalb einer Stunde', () => {
    const now = 1_000_000_000
    expect(isFresh(draft(now - DRAFT_MAX_AGE_MS + 1), now)).toBe(true)
  })

  it('gilt nach einer Stunde nicht mehr', () => {
    // Ein Formular von gestern wiederherzustellen verwirrt mehr, als es hilft.
    const now = 1_000_000_000
    expect(isFresh(draft(now - DRAFT_MAX_AGE_MS), now)).toBe(false)
  })
})

describe('start', () => {
  it('legt den Entwurf ab und meldet Erfolg', () => {
    const flow = useCreationFlow()
    const ok = flow.start({
      returnTo: '/orders/new?vehicleId=f-1',
      entity: 'Kunde',
      field: 'customerId',
      state: { title: 'Bremsen' },
    })

    expect(ok).toBe(true)
    expect(stored()).toHaveLength(1)
    expect(stored()[0]).toMatchObject({
      entity: 'Kunde',
      field: 'customerId',
      state: { title: 'Bremsen' },
    })
  })

  it('nimmt keine Binärfelder mit', () => {
    const flow = useCreationFlow()
    flow.start({
      returnTo: '/vehicles/new',
      entity: 'Kunde',
      field: 'customerId',
      state: { make: 'VW', photos: ['data:image/png;base64,AAA'] },
    })
    expect(stored()[0]?.state).toEqual({ make: 'VW' })
  })

  it('B-056: nimmt nur ein Ziel innerhalb der Anwendung', () => {
    // Ein Rücksprung auf eine fremde Adresse wäre eine offene Weiterleitung.
    const flow = useCreationFlow()
    flow.start({
      returnTo: 'https://example.invalid/phishing',
      entity: 'Kunde',
      field: 'customerId',
      state: {},
    })
    expect(stored()[0]?.returnTo).toBe('/')
  })

  it('verweigert eine Schleife und sagt warum', () => {
    // Einen Kunden aus einem Kunden anzulegen führt nirgendwohin.
    const flow = useCreationFlow()
    flow.start({ returnTo: '/orders/new', entity: 'Kunde', field: 'customerId', state: {} })

    const second = flow.start({
      returnTo: '/customers/new',
      entity: 'Kunde',
      field: 'customerId',
      state: {},
    })

    expect(second).toBe(false)
    expect(stored()).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith('Ein Kunde wird bereits angelegt.', expect.anything())
  })

  it('verweigert eine zu tiefe Kette', () => {
    const flow = useCreationFlow()
    for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
      expect(flow.start({
        returnTo: '/orders/new',
        entity: `Art ${depth}`,
        field: 'id',
        state: {},
      })).toBe(true)
    }

    expect(flow.start({
      returnTo: '/orders/new',
      entity: 'Noch eine',
      field: 'id',
      state: {},
    })).toBe(false)
    expect(warn).toHaveBeenCalledWith('Zu viele angefangene Datensätze.', expect.anything())
  })

  it('B-111: meldet ein volles Speicherlimit, statt zu schweigen', () => {
    const flow = useCreationFlow()
    const ok = withBrokenStorage('setItem', () => flow.start({
      returnTo: '/orders/new',
      entity: 'Kunde',
      field: 'customerId',
      state: {},
    }))

    expect(ok).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      'Der Zwischenstand konnte nicht gesichert werden.',
      expect.anything(),
    )
  })
})

describe('activeEntities', () => {
  it('nennt, was gerade angelegt wird — der Schleifenschutz', () => {
    const flow = useCreationFlow()
    expect(flow.activeEntities()).toEqual([])

    flow.start({ returnTo: '/orders/new', entity: 'Kunde', field: 'customerId', state: {} })
    flow.start({ returnTo: '/customers/new', entity: 'Fahrzeug', field: 'vehicleId', state: {} })
    expect(flow.activeEntities()).toEqual(['Kunde', 'Fahrzeug'])
  })

  it('zählt einen verfallenen Entwurf nicht mehr mit', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([{
      returnTo: '/orders/new',
      entity: 'Kunde',
      field: 'customerId',
      state: {},
      createdAt: Date.now() - DRAFT_MAX_AGE_MS - 1,
    }]))
    expect(useCreationFlow().activeEntities()).toEqual([])
  })
})

describe('finish', () => {
  it('kehrt zurück und bringt die neue Kennung mit', async () => {
    const flow = useCreationFlow()
    flow.start({
      returnTo: '/orders/new?vehicleId=f-1',
      entity: 'Kunde',
      field: 'customerId',
      state: { title: 'Bremsen' },
    })

    await flow.finish('k-99')

    expect(navigate).toHaveBeenCalledWith({
      path: '/orders/new',
      query: { vehicleId: 'f-1', neu_customerId: 'k-99' },
    })
    expect(stored()).toHaveLength(0)
  })

  it('landet auf der Startseite, wenn es nichts zurückzukehren gibt', async () => {
    await useCreationFlow().finish('k-1')
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('nimmt nur den obersten Entwurf herunter', async () => {
    const flow = useCreationFlow()
    flow.start({ returnTo: '/orders/new', entity: 'Kunde', field: 'customerId', state: {} })
    flow.start({ returnTo: '/customers/new', entity: 'Fahrzeug', field: 'vehicleId', state: {} })

    await flow.finish('f-9')
    expect(stored()).toHaveLength(1)
    expect(stored()[0]?.entity).toBe('Kunde')
  })
})

describe('cancel', () => {
  it('kehrt zurück, ohne etwas auszuwählen', async () => {
    const flow = useCreationFlow()
    flow.start({ returnTo: '/orders/new', entity: 'Kunde', field: 'customerId', state: {} })

    await flow.cancel()
    expect(navigate).toHaveBeenCalledWith('/orders/new')
    expect(stored()).toHaveLength(0)
  })

  it('landet auf der Startseite, wenn nichts angefangen war', async () => {
    await useCreationFlow().cancel()
    expect(navigate).toHaveBeenCalledWith('/')
  })
})

describe('peek und clear', () => {
  it('zeigt den obersten Entwurf, ohne ihn zu nehmen', () => {
    const flow = useCreationFlow()
    flow.start({ returnTo: '/orders/new', entity: 'Kunde', field: 'customerId', state: {} })

    expect(flow.peek()?.entity).toBe('Kunde')
    expect(stored()).toHaveLength(1)
  })

  it('vergisst auf Wunsch alles', () => {
    const flow = useCreationFlow()
    flow.start({ returnTo: '/orders/new', entity: 'Kunde', field: 'customerId', state: {} })

    flow.clear()
    expect(stored()).toHaveLength(0)
    expect(flow.peek()).toBeUndefined()
  })
})

describe('Ein beschädigter Speicher', () => {
  it('führt zu einem Neuanfang, nicht zu einem Fehler', () => {
    // Ein Entwurf ist eine Bequemlichkeit, kein Datenbestand.
    sessionStorage.setItem(STORAGE_KEY, '{kein json')
    expect(useCreationFlow().read()).toEqual([])
  })

  it('nimmt auch etwas anderes als eine Liste gelassen hin', () => {
    sessionStorage.setItem(STORAGE_KEY, '{"entity":"Kunde"}')
    expect(useCreationFlow().read()).toEqual([])
  })

  it('kommt auch ohne lesbaren Speicher zurecht', () => {
    const drafts = withBrokenStorage('getItem', () => useCreationFlow().read())
    expect(drafts).toEqual([])
  })

  it('scheitert beim Vergessen nicht an einem gesperrten Speicher', () => {
    expect(() => withBrokenStorage('removeItem', () => useCreationFlow().clear()))
      .not.toThrow()
  })
})
