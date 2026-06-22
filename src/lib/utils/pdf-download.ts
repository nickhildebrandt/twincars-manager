/**
 * Shared client-side helper to open a base64-encoded PDF (as returned
 * by the various `getXPdfRemote` / `getXLabelPdfRemote` remotes) in a
 * new browser tab.
 *
 * The base64 → `Uint8Array` → `Blob` → `blob:` URL dance is the same
 * everywhere — keeping it in one place avoids subtle drift (e.g. one
 * call site forgetting to `revokeObjectURL` and leaking memory).
 *
 * The browser's built-in PDF viewer ships its own download / print
 * toolbar, so we deliberately don't trigger an automatic download
 * here — opening in a tab lets the user preview, then print or save
 * with one click.
 *
 * @param payload base64-encoded PDF payload + filename + mime, as
 *   returned by the PDF remotes
 * @example
 * ```ts
 * const res = await busy.run(() => getArticleLabelPdfRemote({ id }).run())
 * openPdfInNewTab(res)
 * ```
 */
export type PdfPayload = {
  /** Base64 payload (no `data:` prefix). */
  base64?: string
  /** Alternative key — the PDF remotes return their bytes under `data`. */
  data?: string
  /** Suggested filename (informational; blob URLs ignore it). */
  filename?: string
  /** MIME type — typically `application/pdf`. */
  mime?: string
}

/** Milliseconds before we revoke the blob URL to free memory. */
const REVOKE_DELAY_MS = 60_000

/**
 * Decode a base64 string to a `Uint8Array`. Exported for unit tests.
 */
export const base64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf
}

/**
 * Build a `blob:` URL for the given PDF payload and open it in a new
 * tab. The URL is revoked after a short delay so the new tab has time
 * to load it without leaking memory long-term.
 */
export const openPdfInNewTab = (payload: PdfPayload): void => {
  const b64 = payload.base64 ?? payload.data ?? ''
  const mime = payload.mime ?? 'application/pdf'
  const bytes = base64ToBytes(b64)
  // Cast through `ArrayBuffer` — the lib-dom `BlobPart` union requires
  // a non-shared buffer, but `Uint8Array.buffer` widens to
  // `ArrayBufferLike`. The runtime value is always a regular
  // `ArrayBuffer` in this code path.
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

/**
 * Trigger an actual file download for a base64-encoded payload (XML,
 * CSV, ...). Unlike {@link openPdfInNewTab}, this never opens a tab —
 * the user always wants a file on disk for these formats (XRechnung XML
 * for the tax office, DATEV CSV for the accountant).
 *
 * Works by creating a hidden `<a download="...">` anchor and clicking
 * it programmatically; the blob URL is revoked after a short delay
 * the same way as for the PDF helper.
 *
 * @param payload base64 payload + filename + mime
 */
export const downloadBase64File = (payload: PdfPayload): void => {
  const b64 = payload.base64 ?? payload.data ?? ''
  const mime = payload.mime ?? 'application/octet-stream'
  const bytes = base64ToBytes(b64)
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = payload.filename ?? 'download'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
