import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRawSnippet, tick } from 'svelte'
import PageHeader from './PageHeader.svelte'
import { pageHeader } from '$lib/stores/page-title.svelte'

/**
 * Component tests for PageHeader. The component renders no visible title of
 * its own — it writes title / back / primaryAction into the global
 * `pageHeader` store (which the AppShell consumes). The only DOM it emits is
 * the optional toolbar snippet wrapper.
 *
 * @group unit
 * @module PageHeader
 */
describe('PageHeader', () => {
  beforeEach(() => {
    pageHeader.reset()
  })

  afterEach(() => {
    pageHeader.reset()
  })

  it('writes the title into the global pageHeader store', async () => {
    render(PageHeader, { props: { title: 'Kunden' } })
    await tick()
    expect(pageHeader.title).toBe('Kunden')
  })

  it('stores the back target when provided', async () => {
    render(PageHeader, {
      props: { title: 'Kunde bearbeiten', back: '/customers' }
    })
    await tick()
    expect(pageHeader.backTarget).toBe('/customers')
  })

  it('stores the primary action when provided', async () => {
    render(PageHeader, {
      props: {
        title: 'Kunden',
        primaryAction: { label: 'Neuer Kunde', href: '/customers/new' }
      }
    })
    await tick()
    expect(pageHeader.primaryAction).toEqual({
      label: 'Neuer Kunde',
      href: '/customers/new'
    })
  })

  it('does not render the title in its own DOM (AppShell owns the bar)', () => {
    const { container } = render(PageHeader, { props: { title: 'Kunden' } })
    expect(container.textContent ?? '').not.toContain('Kunden')
  })

  it('renders the toolbar snippet when provided', () => {
    const toolbar = createRawSnippet(() => ({
      render: () => `<div data-testid="ph-toolbar">Filterleiste</div>`
    }))
    render(PageHeader, { props: { title: 'Kunden', toolbar } })
    expect(screen.getByTestId('ph-toolbar')).toBeInTheDocument()
    expect(screen.getByText('Filterleiste')).toBeInTheDocument()
  })

  it('does not render a toolbar wrapper when no snippet is given', () => {
    const { container } = render(PageHeader, { props: { title: 'Kunden' } })
    expect(container.querySelector('div.mb-4')).toBeNull()
  })
})
