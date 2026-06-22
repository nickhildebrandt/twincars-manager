import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import Loader from './Loader.svelte'

/**
 * Component tests for Loader — variants, sizes, label, a11y attributes.
 *
 * @group unit
 * @module Loader
 */
describe('Loader', () => {
  it('renders the default German label', () => {
    render(Loader)
    expect(screen.getByText('Inhalte werden geladen')).toBeInTheDocument()
  })

  it('renders a custom label', () => {
    render(Loader, { props: { label: 'Speichere…' } })
    expect(screen.getByText('Speichere…')).toBeInTheDocument()
  })

  it('default block variant has role=status and aria-live=polite', () => {
    render(Loader)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('inline variant renders an inline-flex container', () => {
    const { container } = render(Loader, { props: { variant: 'inline' } })
    const span = container.querySelector('span.inline-flex')
    expect(span).not.toBeNull()
    expect(span).toHaveTextContent('Inhalte werden geladen')
  })

  it('overlay variant sets role=status, aria-live=polite, aria-busy=true', () => {
    render(Loader, { props: { variant: 'overlay' } })
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-busy', 'true')
  })

  it('size sm applies loading-sm spinner class', () => {
    const { container } = render(Loader, { props: { size: 'sm' } })
    expect(container.querySelector('.loading-sm')).not.toBeNull()
  })

  it('size md (default) applies loading-md spinner class', () => {
    const { container } = render(Loader)
    expect(container.querySelector('.loading-md')).not.toBeNull()
  })

  it('size lg applies loading-lg spinner class', () => {
    const { container } = render(Loader, { props: { size: 'lg' } })
    expect(container.querySelector('.loading-lg')).not.toBeNull()
  })
})
