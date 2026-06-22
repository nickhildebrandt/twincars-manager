import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  base64ToBytes,
  downloadBase64File,
  openPdfInNewTab
} from './pdf-download'

/**
 * Unit tests for the shared PDF download helper.
 *
 * @group unit
 * @module pdf-download
 */
describe('pdf-download', () => {
  describe('base64ToBytes', () => {
    it('round-trips ASCII payloads exactly', () => {
      const input = 'hello world'
      const b64 = btoa(input)
      const bytes = base64ToBytes(b64)
      expect(Array.from(bytes)).toEqual(
        Array.from(input).map((c) => c.charCodeAt(0))
      )
    })

    it('decodes a known PDF magic sequence', () => {
      // "%PDF-1.7" — the leading bytes of any PDF file.
      const b64 = btoa('%PDF-1.7')
      const bytes = base64ToBytes(b64)
      expect(bytes[0]).toBe(0x25) // %
      expect(bytes[1]).toBe(0x50) // P
      expect(bytes[2]).toBe(0x44) // D
      expect(bytes[3]).toBe(0x46) // F
      expect(bytes.byteLength).toBe(8)
    })

    it('produces an empty array for the empty string', () => {
      expect(base64ToBytes('').byteLength).toBe(0)
    })
  })

  describe('openPdfInNewTab', () => {
    let createSpy: ReturnType<typeof vi.fn>
    let revokeSpy: ReturnType<typeof vi.fn>
    let openSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      vi.useFakeTimers()
      createSpy = vi.fn(() => 'blob:mock-url')
      revokeSpy = vi.fn()
      openSpy = vi.fn()
      // jsdom only ships partial URL.* — replace with our spies.
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: createSpy,
        revokeObjectURL: revokeSpy
      })
      vi.stubGlobal('open', openSpy)
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it('builds a blob URL and opens it in a new tab', () => {
      openPdfInNewTab({
        base64: btoa('%PDF-1.7'),
        filename: 'label.pdf',
        mime: 'application/pdf'
      })

      expect(createSpy).toHaveBeenCalledTimes(1)
      const blobArg = createSpy.mock.calls[0][0] as Blob
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toBe('application/pdf')

      expect(openSpy).toHaveBeenCalledTimes(1)
      expect(openSpy).toHaveBeenCalledWith(
        'blob:mock-url',
        '_blank',
        'noopener'
      )
    })

    it('also accepts the `data` key from the remote response shape', () => {
      openPdfInNewTab({
        data: btoa('%PDF-1.7'),
        filename: 'label.pdf',
        mime: 'application/pdf'
      })

      expect(createSpy).toHaveBeenCalledTimes(1)
      expect(openSpy).toHaveBeenCalledWith(
        'blob:mock-url',
        '_blank',
        'noopener'
      )
    })

    it('falls back to application/pdf when no mime is given', () => {
      openPdfInNewTab({ base64: btoa('x') })
      const blobArg = createSpy.mock.calls[0][0] as Blob
      expect(blobArg.type).toBe('application/pdf')
    })

    it('revokes the blob URL after the delay to avoid leaks', () => {
      openPdfInNewTab({ base64: btoa('x'), mime: 'application/pdf' })
      expect(revokeSpy).not.toHaveBeenCalled()
      vi.advanceTimersByTime(60_000)
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url')
    })
  })

  describe('downloadBase64File', () => {
    let createSpy: ReturnType<typeof vi.fn>
    let revokeSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      vi.useFakeTimers()
      createSpy = vi.fn(() => 'blob:download-url')
      revokeSpy = vi.fn()
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: createSpy,
        revokeObjectURL: revokeSpy
      })
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it('downloads an XRechnung XML file with the right mime type', () => {
      // Capture clicks on the synthesised anchor.
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {})

      downloadBase64File({
        base64: btoa('<?xml version="1.0"?><Invoice/>'),
        filename: 'xrechnung.xml',
        mime: 'application/xml'
      })

      expect(createSpy).toHaveBeenCalledTimes(1)
      const blobArg = createSpy.mock.calls[0][0] as Blob
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toBe('application/xml')
      expect(clickSpy).toHaveBeenCalledTimes(1)
      clickSpy.mockRestore()
    })

    it('downloads a CSV (DATEV export) and applies the given filename', () => {
      let downloadAttr = ''
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          downloadAttr = this.download
        })

      downloadBase64File({
        data: btoa('Spalte1;Spalte2\nWert1;Wert2'),
        filename: 'datev-2026-05.csv',
        mime: 'text/csv'
      })

      expect(createSpy).toHaveBeenCalledTimes(1)
      const blobArg = createSpy.mock.calls[0][0] as Blob
      expect(blobArg.type).toBe('text/csv')
      expect(downloadAttr).toBe('datev-2026-05.csv')
      clickSpy.mockRestore()
    })

    it('falls back to a generic mime + filename when neither is given', () => {
      let downloadAttr = ''
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          downloadAttr = this.download
        })

      downloadBase64File({ base64: btoa('payload') })

      const blobArg = createSpy.mock.calls[0][0] as Blob
      expect(blobArg.type).toBe('application/octet-stream')
      expect(downloadAttr).toBe('download')
      clickSpy.mockRestore()
    })

    it('cleans up the blob URL after the revoke delay', () => {
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {})
      downloadBase64File({
        base64: btoa('xml'),
        filename: 'rechnung.xml',
        mime: 'application/xml'
      })
      expect(revokeSpy).not.toHaveBeenCalled()
      vi.advanceTimersByTime(60_000)
      expect(revokeSpy).toHaveBeenCalledWith('blob:download-url')
      clickSpy.mockRestore()
    })
  })
})
