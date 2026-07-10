import { render, screen, waitFor } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Component tests for PdfViewer — the blob-URL iframe preview backed by
 * the single global pdfs remote. Covers: the loading placeholder, the
 * iframe wiring (blob URL + `#filename.pdf` fragment for Chromium's
 * download name), the document/reminder cache routing, the German
 * role=alert error state and blob-URL cleanup on unmount.
 *
 * @group component
 * @module PdfViewer
 */

const { docBytesMock, reminderBytesMock, handleClientErrorMock } = vi.hoisted(
  () => ({
    docBytesMock: vi.fn<(args: { id: string }) => Promise<unknown>>(),
    reminderBytesMock: vi.fn<(args: { id: string }) => Promise<unknown>>(),
    handleClientErrorMock: vi.fn()
  })
)

// The component calls the remotes with `.run()` (event-driven context).
vi.mock('../../../routes/pdfs.remote', () => ({
  getDocumentPdfBytesRemote: (args: { id: string }) => ({
    run: () => docBytesMock(args)
  }),
  getReminderPdfBytesRemote: (args: { id: string }) => ({
    run: () => reminderBytesMock(args)
  })
}))

vi.mock('$lib/utils/client-error', () => ({
  handleClientError: (...args: unknown[]) => handleClientErrorMock(...args)
}))

import PdfViewer from './PdfViewer.svelte'

const pdfPayload = (filename = 'Rechnung-RE-1.pdf') => ({
  filename,
  base64: btoa('%PDF-1.4 test'),
  mime: 'application/pdf'
})

const createObjectURLMock = vi.fn(() => 'blob:pdf-mock')
const revokeObjectURLMock = vi.fn()

beforeEach(() => {
  docBytesMock.mockReset().mockResolvedValue(pdfPayload())
  reminderBytesMock.mockReset().mockResolvedValue(pdfPayload())
  handleClientErrorMock.mockReset()
  createObjectURLMock.mockClear()
  revokeObjectURLMock.mockClear()
  // jsdom ships no blob-URL implementation.
  Object.assign(URL, {
    createObjectURL: createObjectURLMock,
    revokeObjectURL: revokeObjectURLMock
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const iframe = (container: HTMLElement) =>
  container.querySelector('iframe') as HTMLIFrameElement | null

describe('PdfViewer', () => {
  it('shows the German loading placeholder while the bytes are in flight', () => {
    // Never-resolving fetch keeps the component in its loading state.
    docBytesMock.mockReturnValue(new Promise(() => {}))
    const { container } = render(PdfViewer, { props: { documentId: 'd1' } })
    expect(screen.getByText('PDF-Vorschau')).toBeInTheDocument()
    expect(screen.getByText(/Vorschau wird geladen/)).toBeInTheDocument()
    expect(iframe(container)).toBeNull()
  })

  it('renders the iframe from a blob URL with the filename fragment', async () => {
    const { container } = render(PdfViewer, { props: { documentId: 'd1' } })
    await waitFor(() => expect(iframe(container)).not.toBeNull())

    expect(docBytesMock).toHaveBeenCalledWith({ id: 'd1' })
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    // The Blob carries the decoded bytes and the reported mime type.
    const blob = createObjectURLMock.mock.calls[0] as unknown as [Blob]
    expect(blob[0]).toBeInstanceOf(Blob)
    expect(blob[0].type).toBe('application/pdf')

    const frame = iframe(container)!
    expect(frame).toHaveAttribute('title', 'PDF-Vorschau')
    expect(frame.getAttribute('src')).toBe('blob:pdf-mock#Rechnung-RE-1.pdf')
    // The loading placeholder is gone once the preview is up.
    expect(screen.queryByText(/Vorschau wird geladen/)).not.toBeInTheDocument()
  })

  it('appends .pdf and URI-encodes a filename without extension', async () => {
    docBytesMock.mockResolvedValue(pdfPayload('Angebot AN 7'))
    const { container } = render(PdfViewer, { props: { documentId: 'd2' } })
    await waitFor(() => expect(iframe(container)).not.toBeNull())
    expect(iframe(container)!.getAttribute('src')).toBe(
      'blob:pdf-mock#Angebot%20AN%207.pdf'
    )
  })

  it('routes kind="reminder" to the dunning cache remote', async () => {
    const { container } = render(PdfViewer, {
      props: { documentId: 'r1', kind: 'reminder' }
    })
    await waitFor(() => expect(iframe(container)).not.toBeNull())
    expect(reminderBytesMock).toHaveBeenCalledWith({ id: 'r1' })
    expect(docBytesMock).not.toHaveBeenCalled()
  })

  it('shows the curated German error as role=alert when loading fails', async () => {
    docBytesMock.mockRejectedValue(new Error('boom'))
    const { container } = render(PdfViewer, { props: { documentId: 'd1' } })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('PDF konnte nicht geladen werden.')
    expect(iframe(container)).toBeNull()
    // The raw error goes through the central client-error handler only.
    expect(handleClientErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      'PDF-Vorschau'
    )
  })

  it('revokes the blob URL on unmount', async () => {
    const { container, unmount } = render(PdfViewer, {
      props: { documentId: 'd1' }
    })
    await waitFor(() => expect(iframe(container)).not.toBeNull())
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
    unmount()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:pdf-mock')
  })

  it('applies the height prop to the embedded viewer', async () => {
    const { container } = render(PdfViewer, {
      props: { documentId: 'd1', height: '480px' }
    })
    await waitFor(() => expect(iframe(container)).not.toBeNull())
    expect(iframe(container)!.getAttribute('style')).toContain('height: 480px')
  })
})
