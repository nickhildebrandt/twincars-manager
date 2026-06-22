import { describe, it, expect, beforeEach } from 'vitest'
import { formDirty } from './form-dirty.svelte'

/**
 * Unit tests for the global form-dirty store.
 *
 * @group unit
 * @module form-dirty
 */
describe('formDirty store', () => {
  beforeEach(() => {
    formDirty.clear()
  })

  it('starts clean', () => {
    expect(formDirty.dirty).toBe(false)
  })

  it('set(true) marks dirty', () => {
    formDirty.set(true)
    expect(formDirty.dirty).toBe(true)
  })

  it('set(false) marks clean', () => {
    formDirty.set(true)
    formDirty.set(false)
    expect(formDirty.dirty).toBe(false)
  })

  it('clear resets to clean', () => {
    formDirty.set(true)
    formDirty.clear()
    expect(formDirty.dirty).toBe(false)
  })
})
