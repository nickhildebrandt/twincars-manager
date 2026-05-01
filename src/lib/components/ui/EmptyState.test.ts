import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import EmptyState from './EmptyState.svelte'

/**
 * Component tests for EmptyState.
 *
 * @group component
 * @module EmptyState
 */
describe('EmptyState', () => {
  it('renders title and description', () => {
    render(EmptyState, {
      props: { title: 'Keine Daten', description: 'Bitte etwas anlegen.' }
    })
    expect(screen.getByText('Keine Daten')).toBeInTheDocument()
    expect(screen.getByText('Bitte etwas anlegen.')).toBeInTheDocument()
  })

  it('renders only title when description is omitted', () => {
    render(EmptyState, { props: { title: 'Leer' } })
    expect(screen.getByText('Leer')).toBeInTheDocument()
  })
})
