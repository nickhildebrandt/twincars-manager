import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ImageUploader from './ImageUploader.svelte'
import { toast } from '$lib/stores/toast.svelte'

/**
 * Component tests for ImageUploader.
 *
 * @group unit
 * @module ImageUploader
 */

const PNG_DATA_URL = 'data:image/png;base64,AAAA'

beforeEach(() => {
  toast.dismiss()
})

afterEach(() => {
  toast.dismiss()
  vi.restoreAllMocks()
})

const getFileInput = (container: HTMLElement): HTMLInputElement => {
  const input = container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement
  if (!input) throw new Error('file input not rendered')
  return input
}

const getDropZone = (container: HTMLElement): HTMLElement => {
  const zone = container.querySelector('[data-drag-active]') as HTMLElement
  if (!zone) throw new Error('drop zone not rendered')
  return zone
}

/**
 * jsdom's DataTransfer is intentionally minimal — `files` is read-only
 * and `types` must include the literal string 'Files' for the
 * component's drag detection to fire. This builder mimics just enough
 * of the DataTransfer surface for the drop handler.
 */
const makeDataTransfer = (files: File[]): DataTransfer => {
  const fileList: Record<number | string, unknown> = {
    length: files.length,
    item: (i: number) => files[i] ?? null
  }
  files.forEach((f, i) => {
    fileList[i] = f
  })
  return {
    files: fileList as unknown as FileList,
    types: ['Files'],
    items: [],
    dropEffect: 'none',
    effectAllowed: 'all',
    clearData: () => {},
    getData: () => '',
    setData: () => {},
    setDragImage: () => {}
  } as unknown as DataTransfer
}

describe('ImageUploader', () => {
  it('renders an empty placeholder in gallery mode', () => {
    render(ImageUploader, {
      props: { images: [], onUpload: vi.fn().mockResolvedValue(undefined) }
    })
    expect(screen.getByText(/Noch keine Fotos hinterlegt/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Bilder hinzufügen/i })
    ).toBeInTheDocument()
  })

  it('renders the empty placeholder in single mode', () => {
    render(ImageUploader, {
      props: {
        images: [],
        single: true,
        onUpload: vi.fn().mockResolvedValue(undefined)
      }
    })
    expect(screen.getByText(/Kein Bild hinterlegt/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Bild hinzufügen/i })
    ).toBeInTheDocument()
  })

  it('renders title and hint when provided', () => {
    render(ImageUploader, {
      props: {
        images: [],
        title: 'Fahrzeugfotos',
        hint: 'PNG, JPG, WebP — bis 5 MB',
        onUpload: vi.fn().mockResolvedValue(undefined)
      }
    })
    expect(screen.getByText('Fahrzeugfotos')).toBeInTheDocument()
    expect(screen.getByText(/PNG, JPG, WebP/)).toBeInTheDocument()
  })

  it('shows the preview image in single mode when an image is set', () => {
    render(ImageUploader, {
      props: {
        images: [{ id: '1', dataUrl: PNG_DATA_URL }],
        single: true,
        onUpload: vi.fn().mockResolvedValue(undefined)
      }
    })
    const img = screen.getByAltText('Vorschau') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toBe(PNG_DATA_URL)
    // CTA flips to "Bild ersetzen" once an image is set.
    expect(
      screen.getByRole('button', { name: /Bild ersetzen/i })
    ).toBeInTheDocument()
  })

  it('selecting a valid PNG fires onUpload with mime + dataUrl', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const { container } = render(ImageUploader, {
      props: { images: [], onUpload }
    })
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    const input = getFileInput(container)
    await fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
    const arg = onUpload.mock.calls[0][0]
    expect(arg.mime).toBe('image/png')
    expect(arg.dataUrl).toMatch(/^data:image\/png/)
  })

  it('rejects a non-image mime type and surfaces a German toast', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const { container } = render(ImageUploader, {
      props: { images: [], onUpload }
    })
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' })
    const input = getFileInput(container)
    await fireEvent.change(input, { target: { files: [file] } })
    expect(onUpload).not.toHaveBeenCalled()
    expect(toast.current?.variant).toBe('error')
    expect(toast.current?.message).toMatch(/keine Bilddatei/)
  })

  it('rejects a file exceeding maxBytes', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const { container } = render(ImageUploader, {
      props: { images: [], maxBytes: 10, onUpload }
    })
    const big = new File([new Uint8Array(50)], 'big.png', { type: 'image/png' })
    const input = getFileInput(container)
    await fireEvent.change(input, { target: { files: [big] } })
    expect(onUpload).not.toHaveBeenCalled()
    expect(toast.current?.variant).toBe('error')
    expect(toast.current?.message).toMatch(/größer als/)
  })

  it('delete button calls onDelete with the image id (single mode)', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(ImageUploader, {
      props: {
        images: [{ id: 'img-1', dataUrl: PNG_DATA_URL }],
        single: true,
        onUpload: vi.fn().mockResolvedValue(undefined),
        onDelete
      }
    })
    await user.click(screen.getByRole('button', { name: /Bild entfernen/i }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('img-1'))
  })

  it('hides the delete button when allowDelete=false', () => {
    render(ImageUploader, {
      props: {
        images: [{ id: 'img-1', dataUrl: PNG_DATA_URL }],
        single: true,
        allowDelete: false,
        onUpload: vi.fn().mockResolvedValue(undefined),
        onDelete: vi.fn()
      }
    })
    expect(
      screen.queryByRole('button', { name: /Bild entfernen/i })
    ).not.toBeInTheDocument()
  })

  it('shows the drag-and-drop hint text in the empty placeholder', () => {
    render(ImageUploader, {
      props: { images: [], onUpload: vi.fn().mockResolvedValue(undefined) }
    })
    expect(
      screen.getByText(/Bilder hierher ziehen oder Datei auswählen/)
    ).toBeInTheDocument()
  })

  it('flips the active-style flag on dragenter', async () => {
    const { container } = render(ImageUploader, {
      props: { images: [], onUpload: vi.fn().mockResolvedValue(undefined) }
    })
    const zone = getDropZone(container)
    expect(zone.dataset.dragActive).toBe('false')
    await fireEvent.dragEnter(zone, { dataTransfer: makeDataTransfer([]) })
    expect(zone.dataset.dragActive).toBe('true')
    expect(zone.className).toMatch(/border-primary/)
    expect(zone.className).toMatch(/border-dashed/)
  })

  it('clears the active-style flag on dragleave', async () => {
    const { container } = render(ImageUploader, {
      props: { images: [], onUpload: vi.fn().mockResolvedValue(undefined) }
    })
    const zone = getDropZone(container)
    await fireEvent.dragEnter(zone, { dataTransfer: makeDataTransfer([]) })
    expect(zone.dataset.dragActive).toBe('true')
    await fireEvent.dragLeave(zone, { dataTransfer: makeDataTransfer([]) })
    expect(zone.dataset.dragActive).toBe('false')
    expect(zone.className).not.toMatch(/border-primary/)
  })

  it('drop of a valid image calls onUpload with the correct File payload', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const { container } = render(ImageUploader, {
      props: { images: [], onUpload }
    })
    const zone = getDropZone(container)
    const file = new File(['x'], 'dropped.png', { type: 'image/png' })
    await fireEvent.dragEnter(zone, { dataTransfer: makeDataTransfer([file]) })
    await fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) })
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
    const arg = onUpload.mock.calls[0][0]
    expect(arg.mime).toBe('image/png')
    expect(arg.dataUrl).toMatch(/^data:image\/png/)
    // After a successful drop the active flag must be cleared.
    expect(zone.dataset.dragActive).toBe('false')
  })

  it('drop of a non-image rejects with toast and does not call onUpload', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const { container } = render(ImageUploader, {
      props: { images: [], onUpload }
    })
    const zone = getDropZone(container)
    const file = new File(['x'], 'note.txt', { type: 'text/plain' })
    await fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) })
    expect(onUpload).not.toHaveBeenCalled()
    expect(toast.current?.variant).toBe('error')
    expect(toast.current?.message).toMatch(/keine Bilddatei/)
  })
})
