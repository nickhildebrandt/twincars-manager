import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the manual ledger entry page — rule 1.1: the
 * Speichern button is always clickable; a click with missing input
 * surfaces the German messages instead of a disabled button.
 *
 * @group component
 * @module ledger-new-page
 */

const createEntryMock = vi.hoisted(() =>
  vi.fn<(input: unknown) => Promise<unknown>>()
)

vi.mock('$app/state', () => ({
  page: { url: new URL('http://localhost/ledger/new'), params: {} }
}))
vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

vi.mock('../ledger.remote', () => ({
  createLedgerEntryRemote: (input: unknown) => createEntryMock(input),
  listCategoriesRemote: () => ({ current: [] })
}))

import LedgerNewPage from './+page.svelte'

describe('ledger new page', () => {
  beforeEach(() => {
    createEntryMock.mockReset()
    createEntryMock.mockResolvedValue(undefined)
  })

  it('keeps Speichern enabled while the form is empty (rule 1.1)', () => {
    render(LedgerNewPage)
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('shows the description error on a click without a description', async () => {
    const user = userEvent.setup()
    render(LedgerNewPage)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(createEntryMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte eine Beschreibung eingeben.')
    ).toBeInTheDocument()
  })

  it('shows the amount error once a description is present', async () => {
    const user = userEvent.setup()
    const { container } = render(LedgerNewPage)
    const description = container.querySelector(
      'input[maxlength="500"]'
    ) as HTMLInputElement
    await user.type(description, 'Werkzeugkauf')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(createEntryMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte einen Betrag größer 0 eingeben.')
    ).toBeInTheDocument()
  })
})
