import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the inline "Arbeit erfassen" modal that lives on
 * invoice / offer detail pages. The remote-function imports are mocked
 * so we can observe the create call shape without touching the real
 * server transport.
 *
 * @group component
 * @module QuickTimeEntryModal
 */

const { createTimeEntryMock, listRefreshMock, currentEmployeeMock } =
  vi.hoisted(() => ({
    createTimeEntryMock: vi.fn<(input: unknown) => Promise<unknown>>(),
    listRefreshMock: vi.fn<() => Promise<void>>(),
    currentEmployeeMock: vi.fn()
  }))

vi.mock('../../../routes/hours/hours.remote', () => {
  const currentEmployeeRemote = () => ({ current: currentEmployeeMock() })
  const listTimeEntriesRemote = () => ({ refresh: listRefreshMock })
  const createTimeEntryRemote = (input: unknown) => createTimeEntryMock(input)
  return { createTimeEntryRemote, currentEmployeeRemote, listTimeEntriesRemote }
})

// `busy.run(fn)` is just `fn()` in tests — we don't exercise the timer
// tier here, only the form submit flow.
vi.mock('$lib/stores/busy.svelte', () => ({
  busy: {
    active: false,
    slow: false,
    run: (fn: () => unknown) => Promise.resolve(fn())
  }
}))

vi.mock('$lib/stores/toast.svelte', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

vi.mock('$lib/utils/client-error', () => ({ handleClientError: vi.fn() }))

import QuickTimeEntryModal from './QuickTimeEntryModal.svelte'

describe('QuickTimeEntryModal', () => {
  beforeEach(() => {
    createTimeEntryMock.mockReset()
    listRefreshMock.mockReset()
    createTimeEntryMock.mockResolvedValue({ id: 'te-1' })
    listRefreshMock.mockResolvedValue(undefined)
    currentEmployeeMock.mockReturnValue({
      id: 'emp-1',
      firstName: 'Anna',
      lastName: 'Mustermann',
      personnelNumber: 'MA-0001'
    })
  })

  it('renders the form fields when open', () => {
    render(QuickTimeEntryModal, {
      props: { open: true, documentId: 'doc-1', onClose: vi.fn() }
    })
    expect(screen.getByText(/Arbeit erfassen/)).toBeInTheDocument()
    expect(screen.getByText(/Datum/)).toBeInTheDocument()
    expect(screen.getByText(/Stunden/)).toBeInTheDocument()
    expect(screen.getByText(/Was wurde gemacht/)).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(QuickTimeEntryModal, {
      props: { open: false, documentId: 'doc-1', onClose: vi.fn() }
    })
    expect(screen.queryByText(/Arbeit erfassen/)).not.toBeInTheDocument()
  })

  it('keeps Speichern disabled without a task description', async () => {
    render(QuickTimeEntryModal, {
      props: { open: true, documentId: 'doc-1', onClose: vi.fn() }
    })
    const btn = screen.getByRole('button', {
      name: /speichern/i,
      hidden: true
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(createTimeEntryMock).not.toHaveBeenCalled()
  })

  it('submits with the resolved employee id and link to the document', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(QuickTimeEntryModal, {
      props: { open: true, documentId: 'doc-XYZ', onClose }
    })
    const taskInput = screen.getByPlaceholderText(/Bremsen prüfen/i)
    await user.type(taskInput, 'Inspektion durchgeführt')
    await user.click(
      screen.getByRole('button', { name: /speichern/i, hidden: true })
    )

    expect(createTimeEntryMock).toHaveBeenCalledTimes(1)
    const payload = createTimeEntryMock.mock.calls[0][0] as Record<
      string,
      unknown
    >
    expect(payload.employeeId).toBe('emp-1')
    expect(payload.documentId).toBe('doc-XYZ')
    expect(payload.task).toBe('Inspektion durchgeführt')
    expect(typeof payload.date).toBe('string')
    expect(typeof payload.hours).toBe('number')

    // The doc-scoped list query is refreshed so the "Erfasste Stunden"
    // card on the parent page picks up the new row immediately.
    expect(listRefreshMock).toHaveBeenCalled()
  })

  it('errors out when no employee profile is linked to the caller', async () => {
    currentEmployeeMock.mockReturnValue(null)
    const user = userEvent.setup()
    render(QuickTimeEntryModal, {
      props: { open: true, documentId: 'doc-1', onClose: vi.fn() }
    })
    const taskInput = screen.getByPlaceholderText(/Bremsen prüfen/i)
    await user.type(taskInput, 'Werkstattorganisation')
    await user.click(
      screen.getByRole('button', { name: /speichern/i, hidden: true })
    )
    expect(createTimeEntryMock).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Mitarbeiterprofil mit Ihrem Konto verknüpft/i)
    ).toBeInTheDocument()
  })

  it('closes when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(QuickTimeEntryModal, {
      props: { open: true, documentId: 'doc-1', onClose }
    })
    await user.click(
      screen.getByRole('button', { name: /abbrechen/i, hidden: true })
    )
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(createTimeEntryMock).not.toHaveBeenCalled()
  })
})
