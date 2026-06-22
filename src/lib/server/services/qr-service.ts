/**
 * QR-code rendering service.
 *
 * Wraps the `qrcode` library with two narrow helpers used by the
 * label / sale-sign PDF renderers:
 *
 *  - {@link renderQrPng} for PDF embedding (`pdf-lib` happily takes a
 *    PNG buffer).
 *  - {@link renderQrSvg} for sharper print output where an SVG can be
 *    inlined into HTML (e.g. future print views in the browser).
 *
 * Payload convention (set by the caller, not enforced here):
 *
 *  - **Articles**: encode `{origin}/items/<articleNumber>` so a phone
 *    scanner deep-links into the app's item detail view.
 *  - **Tire-storage**: encode the bare storage number (e.g.
 *    `L-2026-0001`). The workshop scanner reads it offline and the
 *    Phase-7 public API will resolve it server-side. Keeping the QR
 *    payload independent of any URL means the same printed label keeps
 *    working if we ever move the app behind a different domain.
 *
 * Errors:
 *  - Empty input is rejected with a German user-facing message.
 *  - All other errors bubble up untouched; the global error hook
 *    surfaces them as a generic 500 to keep the message safe.
 *
 * @module qr-service
 */

import QRCode from 'qrcode'

const MIN_SCALE = 2
const MAX_SCALE = 32

/**
 * Render a QR code as a PNG `Buffer`. Suitable for embedding via
 * `pdf-lib`'s `embedPng`.
 *
 * @param data    URL or free-text payload to encode. Must be non-empty.
 * @param opts.size  Approximate PNG edge length in pixels (default 320).
 *                   Internally translated to a `scale` between 2 and 32
 *                   so very small or very large requests stay readable.
 */
export const renderQrPng = async (
  data: string,
  opts: { size?: number } = {}
): Promise<Buffer> => {
  const payload = (data ?? '').trim()
  if (!payload) throw new Error('QR-Inhalt darf nicht leer sein.')
  const size = opts.size ?? 320
  // A QR with ~25 modules and 2-module margin yields ~29 modules wide.
  // Translate the requested pixel size into a per-module `scale` so the
  // resulting bitmap is close to (but never below) the request.
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(size / 29)))
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale,
    type: 'png'
  })
}

/**
 * Render a QR code as an SVG string. Sharper than PNG for printing and
 * cheap to inline into HTML.
 *
 * @param data URL or free-text payload to encode. Must be non-empty.
 */
export const renderQrSvg = async (data: string): Promise<string> => {
  const payload = (data ?? '').trim()
  if (!payload) throw new Error('QR-Inhalt darf nicht leer sein.')
  return QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2
  })
}
