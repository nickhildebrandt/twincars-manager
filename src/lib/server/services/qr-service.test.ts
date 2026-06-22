// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderQrPng, renderQrSvg } from './qr-service'

/**
 * The `qrcode` library is deterministic for the same input/options, so
 * we assert on stable byte/content signatures rather than mocking it
 * out. The tests cover both renderers (PNG + SVG) plus the empty-input
 * rejection that protects callers against accidentally encoding an
 * empty string into a label.
 *
 * @group unit
 * @module qr-service
 */
describe('renderQrPng', () => {
  it('returns a PNG buffer (starts with PNG magic bytes)', async () => {
    const buf = await renderQrPng('https://example.com/items/ART-00001')
    expect(Buffer.isBuffer(buf)).toBe(true)
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A.
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(buf.length).toBeGreaterThan(100)
  })

  it('respects the size option (larger size → larger buffer)', async () => {
    const small = await renderQrPng('hello', { size: 80 })
    const large = await renderQrPng('hello', { size: 800 })
    expect(large.length).toBeGreaterThan(small.length)
  })

  it('rejects empty input with a German message', async () => {
    await expect(renderQrPng('')).rejects.toThrow(/QR-Inhalt/i)
    await expect(renderQrPng('   ')).rejects.toThrow(/QR-Inhalt/i)
  })
})

describe('renderQrSvg', () => {
  it('returns an SVG string that includes the expected root element', async () => {
    const svg = await renderQrSvg('L-2026-0042')
    expect(typeof svg).toBe('string')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('viewBox')
  })

  it('produces deterministic output for the same input', async () => {
    const a = await renderQrSvg('L-2026-0042')
    const b = await renderQrSvg('L-2026-0042')
    expect(a).toBe(b)
  })

  it('produces different output for different payloads', async () => {
    const a = await renderQrSvg('L-2026-0042')
    const b = await renderQrSvg('L-2026-0099')
    expect(a).not.toBe(b)
  })

  it('rejects empty input with a German message', async () => {
    await expect(renderQrSvg('')).rejects.toThrow(/QR-Inhalt/i)
  })
})
