import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the ad-hoc email dialog on the customer detail
 * page — rule 1.1: the Senden button in the dialog is always
 * clickable; a click with an empty subject/body shows the German
 * message inside the dialog instead of a disabled button.
 *
 * @group component
 * @module customer-detail-email
 */

const sendEmailMock = vi.hoisted(() =>
  vi.fn<(input: unknown) => Promise<unknown>>()
)

vi.mock('$app/state', () => ({
  page: {
    url: new URL('http://localhost/customers/c1'),
    params: { id: 'c1' },
    state: {}
  }
}))
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }))

vi.mock('../customers.remote', () => ({
  getCustomerRemote: async () => ({
    id: 'c1',
    kind: 'regular',
    customerNumber: 'K-1001',
    company: null,
    salutation: null,
    firstName: 'Max',
    lastName: 'Muster',
    street: null,
    zip: null,
    city: null,
    phone: null,
    mobile: null,
    email: 'max@example.com',
    website: null,
    notes: null,
    ebayHandle: null,
    wantsBroadcast: false,
    wantsTireReminders: false
  }),
  getCustomerRelatedRemote: async () => ({ vehicles: [], invoices: [] }),
  sendAdHocCustomerEmailRemote: (input: unknown) => sendEmailMock(input)
}))

import DetailHost from './DetailHost.svelte'

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  render(DetailHost)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /e-mail schreiben/i })
    ).toBeInTheDocument()
  )
  await user.click(screen.getByRole('button', { name: /e-mail schreiben/i }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /^senden$/i })
    ).toBeInTheDocument()
  )
}

describe('customer detail email dialog', () => {
  beforeEach(() => {
    sendEmailMock.mockReset()
    sendEmailMock.mockResolvedValue(undefined)
  })

  it('keeps Senden enabled while subject/body are empty (rule 1.1)', async () => {
    const user = userEvent.setup()
    await openDialog(user)
    expect(screen.getByRole('button', { name: /^senden$/i })).not.toBeDisabled()
  })

  it('shows the subject error on a click with an empty subject', async () => {
    const user = userEvent.setup()
    await openDialog(user)
    await user.click(screen.getByRole('button', { name: /^senden$/i }))
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte einen Betreff eingeben.')
    ).toBeInTheDocument()
  })

  it('shows the body error once a subject is present', async () => {
    const user = userEvent.setup()
    await openDialog(user)
    const subject = document.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    await user.type(subject, 'Ihr Termin')
    await user.click(screen.getByRole('button', { name: /^senden$/i }))
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte einen Nachrichtentext eingeben.')
    ).toBeInTheDocument()
  })
})
