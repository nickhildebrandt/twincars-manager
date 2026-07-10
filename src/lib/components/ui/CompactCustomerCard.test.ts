import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'

import CompactCustomerCard from './CompactCustomerCard.svelte'

/**
 * Component tests for CompactCustomerCard — the read-only holder card
 * shown e.g. on the vehicle detail Halter tab: label precedence
 * (company > person name > customer number), fallback dashes and the
 * "Zum Kunden" link.
 *
 * @group component
 * @module CompactCustomerCard
 */

describe('CompactCustomerCard', () => {
  it('renders number, contact fields and the customer link', () => {
    render(CompactCustomerCard, {
      customerNumber: 'K-1001',
      firstName: 'Max',
      lastName: 'Muster',
      phone: '030 123456',
      email: 'max@example.com',
      href: '/customers/c1'
    })
    expect(screen.getByText('Kunde')).toBeInTheDocument()
    expect(screen.getByText('K-1001')).toBeInTheDocument()
    expect(screen.getByText('Max Muster')).toBeInTheDocument()
    expect(screen.getByText('030 123456')).toBeInTheDocument()
    expect(screen.getByText('max@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zum Kunden' })).toHaveAttribute(
      'href',
      '/customers/c1'
    )
  })

  it('prefers the company name over the person name', () => {
    render(CompactCustomerCard, {
      customerNumber: 'K-2000',
      company: 'Alpha GmbH',
      firstName: 'Max',
      lastName: 'Muster',
      href: '/customers/c2'
    })
    expect(screen.getByText('Alpha GmbH')).toBeInTheDocument()
    expect(screen.queryByText('Max Muster')).not.toBeInTheDocument()
  })

  it('falls back to the customer number and dashes when fields are empty', () => {
    render(CompactCustomerCard, {
      customerNumber: 'K-3000',
      href: '/customers/c3'
    })
    // Number appears twice: as Kundennr. and as the name fallback.
    expect(screen.getAllByText('K-3000')).toHaveLength(2)
    expect(screen.getAllByText('-')).toHaveLength(2)
  })
})
