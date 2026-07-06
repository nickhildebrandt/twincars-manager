import { describe, it, expect, beforeEach } from 'vitest'
import {
  CreationFlowStore,
  creationFlow,
  currentUrl,
  type CreationFlowFrame
} from './creation-flow.svelte'

/**
 * Unit tests for the stack-based creation-flow store: push / finish /
 * cancel, nested two-level chains, cycle detection via
 * `activeEntities`, URL-matched consumption of the pending return and
 * the sessionStorage round-trip incl. stale-flow pruning.
 *
 * @group unit
 * @module creation-flow
 */

const STORAGE_KEY = 'twincars.creation-flow'

const frame = (
  overrides: Partial<CreationFlowFrame> = {}
): CreationFlowFrame => ({
  entity: 'customer',
  returnUrl: '/vehicles/new',
  originField: 'customerId',
  draft: { make: 'VW', model: 'Golf' },
  createdAt: Date.now(),
  ...overrides
})

beforeEach(() => {
  window.sessionStorage.clear()
  creationFlow.reset()
})

describe('creation-flow store', () => {
  it('starts empty', () => {
    const store = new CreationFlowStore()
    expect(store.depth).toBe(0)
    expect(store.top).toBeNull()
    expect(store.activeEntities().size).toBe(0)
    expect(store.pendingReturnFor('/vehicles/new')).toBeNull()
  })

  it('start pushes a frame and exposes it as top', () => {
    const store = new CreationFlowStore()
    const f = frame()
    store.start(f)
    expect(store.depth).toBe(1)
    expect(store.top).toEqual(f)
    expect(store.activeEntities().has('customer')).toBe(true)
  })

  it('finish pops, returns the returnUrl and stores the pending return', () => {
    const store = new CreationFlowStore()
    store.start(frame())
    const url = store.finish({ id: 'c1', label: 'Neu GmbH · Berlin' })
    expect(url).toBe('/vehicles/new')
    expect(store.depth).toBe(0)

    const pending = store.pendingReturnFor('/vehicles/new')
    expect(pending).toEqual({
      returnUrl: '/vehicles/new',
      originField: 'customerId',
      draft: { make: 'VW', model: 'Golf' },
      result: { id: 'c1', label: 'Neu GmbH · Berlin' }
    })
  })

  it('cancel pops with a null result but keeps the draft', () => {
    const store = new CreationFlowStore()
    store.start(frame())
    const url = store.cancel()
    expect(url).toBe('/vehicles/new')

    const pending = store.pendingReturnFor('/vehicles/new')
    expect(pending?.result).toBeNull()
    expect(pending?.draft).toEqual({ make: 'VW', model: 'Golf' })
  })

  it('finish and cancel on an empty stack return null and leave no pending', () => {
    const store = new CreationFlowStore()
    expect(store.finish({ id: 'x', label: 'X' })).toBeNull()
    expect(store.cancel()).toBeNull()
    expect(store.pendingReturnFor('/vehicles/new')).toBeNull()
  })

  it('pendingReturnFor with a mismatching url keeps the pending return', () => {
    const store = new CreationFlowStore()
    store.start(frame())
    store.finish({ id: 'c1', label: 'Neu GmbH' })

    expect(store.pendingReturnFor('/somewhere/else')).toBeNull()
    // Still consumable by the right origin afterwards.
    const pending = store.pendingReturnFor('/vehicles/new')
    expect(pending?.result?.id).toBe('c1')
  })

  it('pendingReturnFor consumes exactly once', () => {
    const store = new CreationFlowStore()
    store.start(frame())
    store.finish({ id: 'c1', label: 'Neu GmbH' })

    expect(store.pendingReturnFor('/vehicles/new')).not.toBeNull()
    expect(store.pendingReturnFor('/vehicles/new')).toBeNull()
  })

  it('supports a nested two-level chain (Auftrag -> Fahrzeug -> Kunde)', () => {
    const store = new CreationFlowStore()
    // Order form starts vehicle creation…
    store.start(
      frame({
        entity: 'vehicle',
        returnUrl: '/orders/new',
        originField: 'vehicleId',
        draft: { title: 'Inspektion' }
      })
    )
    // …and the vehicle page starts customer creation on top.
    store.start(
      frame({
        entity: 'customer',
        returnUrl: '/vehicles/new',
        originField: 'customerId',
        draft: { make: 'VW' }
      })
    )
    expect(store.depth).toBe(2)
    expect(store.activeEntities()).toEqual(new Set(['vehicle', 'customer']))
    expect(store.top?.entity).toBe('customer')

    // Inner finish returns to the vehicle page; the vehicle frame stays.
    expect(store.finish({ id: 'c1', label: 'Neu GmbH' })).toBe('/vehicles/new')
    expect(store.top?.entity).toBe('vehicle')
    const inner = store.pendingReturnFor('/vehicles/new')
    expect(inner?.result?.id).toBe('c1')
    expect(inner?.draft).toEqual({ make: 'VW' })

    // Outer finish returns to the order form.
    expect(store.finish({ id: 'v1', label: 'B-AA 1 · VW Golf' })).toBe(
      '/orders/new'
    )
    expect(store.depth).toBe(0)
    const outer = store.pendingReturnFor('/orders/new')
    expect(outer?.originField).toBe('vehicleId')
    expect(outer?.result?.label).toBe('B-AA 1 · VW Golf')
  })

  it('activeEntities reports every level for the cycle guard', () => {
    const store = new CreationFlowStore()
    store.start(frame({ entity: 'vehicle' }))
    expect(store.activeEntities().has('vehicle')).toBe(true)
    expect(store.activeEntities().has('customer')).toBe(false)

    store.start(frame({ entity: 'customer' }))
    expect(store.activeEntities()).toEqual(new Set(['vehicle', 'customer']))

    store.cancel()
    expect(store.activeEntities()).toEqual(new Set(['vehicle']))
  })

  it('reset drops the stack and the pending return', () => {
    const store = new CreationFlowStore()
    store.start(frame())
    store.start(frame({ entity: 'vehicle', returnUrl: '/orders/new' }))
    store.finish({ id: 'v1', label: 'V' })
    store.reset()
    expect(store.depth).toBe(0)
    expect(store.pendingReturnFor('/orders/new')).toBeNull()
  })

  it('persists stack and pending return to sessionStorage', () => {
    const store = new CreationFlowStore()
    store.start(frame())
    let raw = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(raw.stack).toHaveLength(1)
    expect(raw.stack[0].entity).toBe('customer')
    expect(raw.pending).toBeNull()

    store.finish({ id: 'c1', label: 'Neu GmbH' })
    raw = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(raw.stack).toHaveLength(0)
    expect(raw.pending.result.id).toBe('c1')
  })

  it('a fresh instance rehydrates from sessionStorage (full page load)', () => {
    const first = new CreationFlowStore()
    first.start(frame({ entity: 'vehicle', returnUrl: '/orders/new' }))
    first.start(frame({ entity: 'customer', returnUrl: '/vehicles/new' }))
    first.finish({ id: 'c1', label: 'Neu GmbH' })

    const second = new CreationFlowStore()
    expect(second.depth).toBe(1)
    expect(second.top?.entity).toBe('vehicle')
    expect(second.pendingReturnFor('/vehicles/new')?.result?.id).toBe('c1')
  })

  it('drops an abandoned flow older than one hour on load', () => {
    const first = new CreationFlowStore()
    first.start(frame({ createdAt: Date.now() - 2 * 60 * 60 * 1000 }))

    const second = new CreationFlowStore()
    expect(second.depth).toBe(0)
    expect(second.top).toBeNull()
  })

  it('survives corrupt storage content', () => {
    window.sessionStorage.setItem(STORAGE_KEY, '{not json')
    const store = new CreationFlowStore()
    expect(store.depth).toBe(0)
  })

  it('currentUrl returns path + search in the browser', () => {
    expect(currentUrl()).toBe(window.location.pathname + window.location.search)
  })
})
