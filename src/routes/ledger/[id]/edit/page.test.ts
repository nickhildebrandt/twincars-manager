import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the ledger edit page — rule 1.1: Speichern stays
 * clickable for manual entries; a click with cleared input shows the
 * German message. System-generated entries keep the read-only gate.
 *
 * @group component
 * @module ledger-edit-page
 */

const updateEntryMock = vi.hoisted(() =>
  vi.fn<(input: unknown) => Promise<unknown>>()
)

vi.mock('$app/state', () => ({
  page: {
    url: new URL('http://localhost/ledger/e1/edit'),
    params: { id: 'e1' }
  }
}))
vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

vi.mock('../../ledger.remote', () => ({
  getLedgerEntryRemote: async () => ({
    id: 'e1',
    direction: 'expense',
    entryDate: '2026-07-01',
    amountGross: '119.00',
    taxRate: '19',
    categoryId: null,
    description: 'Werkzeugkauf',
    paymentMethod: null,
    paymentStatus: 'paid',
    source: 'manual'
  }),
  listCategoriesRemote: () => ({ current: [] }),
  updateLedgerEntryRemote: (input: unknown) => updateEntryMock(input),
  deleteLedgerEntryRemote: () => Promise.resolve()
}))

import EditEntryHost from './EditEntryHost.svelte'

const renderPage = async () => {
  const result = render(EditEntryHost)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /^speichern$/i })
    ).toBeInTheDocument()
  )
  return result
}

describe('ledger edit page', () => {
  beforeEach(() => {
    updateEntryMock.mockReset()
    updateEntryMock.mockResolvedValue(undefined)
  })

  it('keeps Speichern enabled with a cleared description (rule 1.1)', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.clear(screen.getByDisplayValue('Werkzeugkauf'))
    expect(
      screen.getByRole('button', { name: /^speichern$/i })
    ).not.toBeDisabled()
  })

  it('shows the German error on a click with a cleared description', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.clear(screen.getByDisplayValue('Werkzeugkauf'))
    await user.click(screen.getByRole('button', { name: /^speichern$/i }))
    expect(updateEntryMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte eine Beschreibung eingeben.')
    ).toBeInTheDocument()
  })
})
