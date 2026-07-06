import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Component tests for VehicleDocuments — empty state, meta rendering
 * (human-readable size, German date, note), the client-side upload
 * pre-checks (mime allowlist + 15 MB) with German toasts, the
 * bytes-only-on-view contract (Anzeigen fetches via the single
 * get-bytes remote and opens a blob URL) and the ConfirmDialog-guarded
 * delete.
 *
 * @group component
 * @module VehicleDocuments
 */

const remote = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  del: vi.fn()
}))

// The component imports the remotes via this exact relative specifier.
vi.mock('../../../routes/vehicles/vehicle-documents.remote', () => ({
  listVehicleDocumentsRemote: (args: unknown) => ({
    run: () => remote.list(args)
  }),
  getVehicleDocumentRemote: (args: unknown) => ({
    run: () => remote.get(args)
  }),
  uploadVehicleDocumentRemote: (args: unknown) => remote.upload(args),
  deleteVehicleDocumentRemote: (args: unknown) => remote.del(args)
}))

import VehicleDocuments from './VehicleDocuments.svelte'
import { toast } from '$lib/stores/toast.svelte'

type Doc = {
  id: string
  fileName: string
  mime: string
  sizeBytes: number
  note: string | null
  uploadedAt: Date | string
}

const pdfDoc: Doc = {
  id: 'd1',
  fileName: 'Kaufvertrag.pdf',
  mime: 'application/pdf',
  sizeBytes: 2_621_440, // 2.5 MB
  note: 'Original',
  uploadedAt: new Date('2026-07-01T10:00:00Z')
}

const imgDoc: Doc = {
  id: 'd2',
  fileName: 'brief.jpg',
  mime: 'image/jpeg',
  sizeBytes: 51_200, // 50 KB
  note: null,
  uploadedAt: new Date('2026-06-15T08:00:00Z')
}

const openSpy = vi.fn()

beforeEach(() => {
  toast.dismiss()
  remote.list.mockReset().mockResolvedValue([])
  remote.get
    .mockReset()
    .mockResolvedValue({
      fileName: 'Kaufvertrag.pdf',
      mime: 'application/pdf',
      dataBase64: btoa('%PDF-1.4 test')
    })
  remote.upload.mockReset().mockResolvedValue({ id: 'new' })
  remote.del.mockReset().mockResolvedValue(undefined)
  openSpy.mockReset()
  vi.stubGlobal('open', openSpy)
  // jsdom ships no blob-URL implementation.
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn()
  })
})

afterEach(() => {
  toast.dismiss()
  vi.unstubAllGlobals()
})

const getFileInput = (container: HTMLElement): HTMLInputElement => {
  const input = container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement
  if (!input) throw new Error('file input not rendered')
  return input
}

describe('VehicleDocuments', () => {
  it('renders the empty state when no documents exist', () => {
    render(VehicleDocuments, { props: { vehicleId: 'v1', initial: [] } })
    expect(screen.getByText('Dokumente')).toBeInTheDocument()
    expect(screen.getByText('Keine Dokumente vorhanden')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Dokument hochladen/i })
    ).toBeInTheDocument()
  })

  it('renders name, human-readable size, German date and note per row', () => {
    render(VehicleDocuments, {
      props: { vehicleId: 'v1', initial: [pdfDoc, imgDoc] }
    })
    expect(screen.getByText('Kaufvertrag.pdf')).toBeInTheDocument()
    expect(screen.getByText('2,5 MB')).toBeInTheDocument()
    expect(screen.getByText('01.07.2026')).toBeInTheDocument()
    expect(screen.getByText('Original')).toBeInTheDocument()
    expect(screen.getByText('brief.jpg')).toBeInTheDocument()
    expect(screen.getByText('50 KB')).toBeInTheDocument()
    // Missing note renders a plain dash.
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('uploads a valid PDF with raw base64 (no data-URL prefix) and the note', async () => {
    const user = userEvent.setup()
    remote.list.mockResolvedValue([pdfDoc])
    const { container } = render(VehicleDocuments, {
      props: { vehicleId: 'v1', initial: [] }
    })
    await user.type(
      screen.getByPlaceholderText(/Notiz zum Upload/i),
      ' Original '
    )
    const file = new File(['%PDF-1.4 test'], 'Kaufvertrag.pdf', {
      type: 'application/pdf'
    })
    await fireEvent.change(getFileInput(container), {
      target: { files: [file] }
    })
    await waitFor(() => expect(remote.upload).toHaveBeenCalledTimes(1))
    const arg = remote.upload.mock.calls[0][0]
    expect(arg.vehicleId).toBe('v1')
    expect(arg.fileName).toBe('Kaufvertrag.pdf')
    expect(arg.mime).toBe('application/pdf')
    expect(arg.dataBase64).toBe(btoa('%PDF-1.4 test'))
    expect(arg.note).toBe('Original')
    // The list refreshes after the upload and renders the new row.
    await waitFor(() =>
      expect(remote.list).toHaveBeenCalledWith({ vehicleId: 'v1' })
    )
    expect(await screen.findByText('Kaufvertrag.pdf')).toBeInTheDocument()
    expect(toast.current?.variant).toBe('success')
    expect(toast.current?.message).toMatch(/hochgeladen/)
  })

  it('rejects a disallowed file type with a German toast', async () => {
    const { container } = render(VehicleDocuments, {
      props: { vehicleId: 'v1', initial: [] }
    })
    const file = new File(['x'], 'virus.exe', {
      type: 'application/octet-stream'
    })
    await fireEvent.change(getFileInput(container), {
      target: { files: [file] }
    })
    expect(remote.upload).not.toHaveBeenCalled()
    expect(toast.current?.variant).toBe('error')
    expect(toast.current?.message).toMatch(/wird nicht unterstützt/)
  })

  it('rejects a file above 15 MB with a German toast', async () => {
    const { container } = render(VehicleDocuments, {
      props: { vehicleId: 'v1', initial: [] }
    })
    const big = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'riesig.pdf', {
      type: 'application/pdf'
    })
    await fireEvent.change(getFileInput(container), {
      target: { files: [big] }
    })
    expect(remote.upload).not.toHaveBeenCalled()
    expect(toast.current?.variant).toBe('error')
    expect(toast.current?.message).toMatch(/größer als 15 MB/)
  })

  it('falls back to the file extension when the browser reports no mime', async () => {
    const { container } = render(VehicleDocuments, {
      props: { vehicleId: 'v1', initial: [] }
    })
    const file = new File(['x'], 'schein.webp', { type: '' })
    await fireEvent.change(getFileInput(container), {
      target: { files: [file] }
    })
    await waitFor(() => expect(remote.upload).toHaveBeenCalledTimes(1))
    expect(remote.upload.mock.calls[0][0].mime).toBe('image/webp')
  })

  it('Anzeigen fetches the bytes via the single get remote and opens a blob URL', async () => {
    const user = userEvent.setup()
    render(VehicleDocuments, { props: { vehicleId: 'v1', initial: [pdfDoc] } })
    await user.click(screen.getByRole('button', { name: /Anzeigen/i }))
    await waitFor(() => expect(remote.get).toHaveBeenCalledWith({ id: 'd1' }))
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1))
    expect(openSpy.mock.calls[0][0]).toMatch(/^blob:mock#/)
    expect(openSpy.mock.calls[0][1]).toBe('_blank')
  })

  it('Löschen asks for confirmation and deletes on confirm', async () => {
    const user = userEvent.setup()
    remote.list.mockResolvedValue([])
    render(VehicleDocuments, { props: { vehicleId: 'v1', initial: [pdfDoc] } })
    await user.click(screen.getByRole('button', { name: /^Löschen$/ }))
    // Nothing is deleted before the dialog is confirmed.
    expect(remote.del).not.toHaveBeenCalled()
    expect(screen.getByText('Dokument löschen')).toBeInTheDocument()
    // jsdom keeps <dialog> content out of the a11y tree — hidden: true.
    await user.click(
      screen.getByRole('button', { name: /Endgültig löschen/i, hidden: true })
    )
    await waitFor(() =>
      expect(remote.del).toHaveBeenCalledWith({ id: 'd1', vehicleId: 'v1' })
    )
    // Row disappears after the refresh with the emptied list.
    expect(await screen.findByText('Keine Dokumente vorhanden')).toBeVisible()
    expect(toast.current?.message).toMatch(/gelöscht/)
  })

  it('keeps the list untouched when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    render(VehicleDocuments, { props: { vehicleId: 'v1', initial: [pdfDoc] } })
    await user.click(screen.getByRole('button', { name: /^Löschen$/ }))
    await user.click(
      screen.getByRole('button', { name: /Abbrechen/i, hidden: true })
    )
    expect(remote.del).not.toHaveBeenCalled()
    expect(screen.getByText('Kaufvertrag.pdf')).toBeInTheDocument()
  })
})
