import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the broadcast (Serienbriefe) page — rule 1.1:
 * the Senden button is always clickable; a click with an empty
 * subject/body shows the German message and does NOT open the send
 * confirmation.
 *
 * @group component
 * @module mailings-page
 */

const sendBroadcastMock = vi.hoisted(() =>
  vi.fn<(input: unknown) => Promise<unknown>>()
)

vi.mock('./mailings.remote', () => ({
  previewBroadcastRecipientsRemote: () =>
    Promise.resolve({
      totalOptIn: 2,
      totalWithEmail: 2,
      sampleNames: ['Anna Muster', 'Bernd Beispiel']
    }),
  listBroadcastHistoryRemote: () => Promise.resolve([]),
  sendBroadcastEmailRemote: (input: unknown) => sendBroadcastMock(input)
}))

import MailingsHost from './MailingsHost.svelte'

const renderPage = async () => {
  const result = render(MailingsHost)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /senden/i })).toBeInTheDocument()
  )
  return result
}

describe('mailings page', () => {
  beforeEach(() => {
    sendBroadcastMock.mockReset()
    sendBroadcastMock.mockResolvedValue({ sent: 2, failed: [] })
  })

  it('keeps Senden enabled while subject/body are empty (rule 1.1)', async () => {
    await renderPage()
    expect(screen.getByRole('button', { name: /senden/i })).not.toBeDisabled()
  })

  it('shows the subject error on a click with an empty subject', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: /senden/i }))
    expect(sendBroadcastMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte einen Betreff eingeben.')
    ).toBeInTheDocument()
    // The confirmation dialog is NOT opened.
    expect(screen.queryByText('Serienbrief senden')).not.toBeInTheDocument()
  })

  it('shows the body error once a subject is present', async () => {
    const user = userEvent.setup()
    const { container } = await renderPage()
    const subject = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    await user.type(subject, 'Sommeraktion')
    await user.click(screen.getByRole('button', { name: /senden/i }))
    expect(sendBroadcastMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte einen Nachrichtentext eingeben.')
    ).toBeInTheDocument()
  })
})
