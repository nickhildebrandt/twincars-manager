import { describe, it, expect, beforeEach } from 'vitest'
import { pageTitle } from './page-title.svelte'

/**
 * Unit tests for the global page-title store.
 *
 * @group unit
 * @module page-title
 */
describe('pageTitle store', () => {
  beforeEach(() => {
    pageTitle.reset()
  })

  it('starts as null', () => {
    expect(pageTitle.current).toBeNull()
  })

  it('set updates the current title', () => {
    pageTitle.set('Neuer Kunde anlegen')
    expect(pageTitle.current).toBe('Neuer Kunde anlegen')
  })

  it('reset clears the title', () => {
    pageTitle.set('foo')
    pageTitle.reset()
    expect(pageTitle.current).toBeNull()
  })
})
