/**
 * PDF generation + caching service.
 *
 * Strategy
 * --------
 * - We render the PDF for a document **once** with `pdf-lib` and persist
 *   the bytes in the `document_pdfs` table (`bytea`).
 * - Each render is keyed by a SHA-256 over a canonical JSON shape of the
 *   document's relevant inputs (line items, totals, customer data,
 *   company settings hash, `updatedAt`). When any of those change, the
 *   hash changes, and the next call to {@link getOrRenderDocumentPdf}
 *   triggers a re-render. Otherwise the cached bytes are served.
 * - The bytes never bleed into list queries — service-layer helpers in
 *   the document/invoice/offer paths only ever load metadata. The actual
 *   payload is only fetched through the dedicated endpoint
 *   `getDocumentPdfBytes` in the remote layer.
 *
 * Layout
 * ------
 * The visual style follows the classic German workshop invoice / KV
 * format we inherited from the legacy "Kfz-Kaufmann" Access app
 * (see `Daten/beispiel-rechnung.pdf` and `beispiel-kostenvoranschlag.pdf`):
 *
 *   ┌─ logo (left) ────────────  company block (right, right-aligned) ─┐
 *   │                                                                   │
 *   │  return-to-sender line (small, underlined)                        │
 *   │  customer salutation / name / address          Document title    │
 *   │                                                Seite, Nr, Kdnr   │
 *   │  Vehicle info (italic, two cols)                                  │
 *   │                                                                   │
 *   │  Intro line ("Gemäss Ihres Auftrages …" / "Wir danken …")         │
 *   │                                                                   │
 *   │  Items table: ArtNr | Anz | Beschreibung | Einzel | Gesamt        │
 *   │                                                                   │
 *   │  Totals box, "Zahlbar bis …", standard closing text              │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Multi-page support: when items overflow the first page we add follow-up
 * pages with a slim repeated header (company name + doc title + page n)
 * and the items table column header. The totals box always lands on the
 * last page, never split.
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage
} from 'pdf-lib'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  customers,
  documentItems,
  documentPdfs,
  documents,
  reminderPdfs,
  reminders,
  vehicles,
  type CompanySettings,
  type Customer,
  type Document,
  type DocumentItem,
  type DocumentPdf,
  type Reminder,
  type ReminderPdf,
  type TireStorage,
  type Vehicle,
  type VehiclePhoto
} from '$lib/server/db/schema'
import { getSettings } from './settings-service'
import { getEffectiveLicensePlate } from './vehicle-service'
import { renderQrPng } from './qr-service'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type DocumentRenderInput = {
  doc: Document
  items: DocumentItem[]
  customer: Customer | null
  /**
   * Vehicle inkl. zum Beleg-Datum gültiges Kennzeichen — wird beim
   * Laden via `getLicensePlateAt(doc.issueDate)` aufgelöst, damit
   * die historische Rechnung auch nach einem späteren Kennzeichen-
   * wechsel das damals gültige Schild zeigt.
   */
  vehicle: (Vehicle & { licensePlate: string | null }) | null
  settings: CompanySettings
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatEur = (v: number | string): string => {
  const n = typeof v === 'string' ? Number(v) : v
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number.isFinite(n) ? n : 0)
}

/** German decimal quantity — trims trailing zeros ("1", "2,5", "0,25"). */
const formatQty = (v: number | string): string => {
  const n = typeof v === 'string' ? Number(v) : v
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  )
}

/** German percentage without unit conversion ("19", "7,5"). */
const formatPercentDe = (v: number | string): string => {
  const n = typeof v === 'string' ? Number(v) : v
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  )
}

const formatDate = (s: string | null | undefined): string => {
  if (!s) return '-'
  // YYYY-MM-DD → DD.MM.YYYY
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s
}

const sortObject = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(sortObject) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = sortObject((value as Record<string, unknown>)[key])
    }
    return out as T
  }
  return value
}

/**
 * Canonical hash over everything that can influence the rendered output.
 * Field order is normalized via {@link sortObject} so two semantically
 * equal payloads always produce the same digest.
 */
export const computeDocumentInputHash = (
  input: DocumentRenderInput
): string => {
  const canonical = sortObject({
    doc: {
      id: input.doc.id,
      number: input.doc.documentNumber,
      type: input.doc.type,
      status: input.doc.status,
      issueDate: input.doc.issueDate,
      serviceDate: input.doc.serviceDate,
      dueDate: input.doc.dueDate,
      paymentMethod: input.doc.paymentMethod,
      taxRate: input.doc.taxRate,
      netTotal: input.doc.netTotal,
      taxTotal: input.doc.taxTotal,
      grossTotal: input.doc.grossTotal,
      discountTotal: input.doc.discountTotal,
      header: input.doc.header,
      footer: input.doc.footer,
      notes: input.doc.notes,
      customerId: input.doc.customerId,
      vehicleId: input.doc.vehicleId,
      updatedAt: input.doc.updatedAt
    },
    items: input.items.map((it) => ({
      n: it.positionNumber,
      d: it.description,
      q: it.quantity,
      u: it.unit,
      p: it.unitPriceNet,
      r: it.discountPercent,
      t: it.taxRate,
      g: it.lineTotalGross,
      net: it.lineTotalNet
    })),
    customer: input.customer
      ? {
          id: input.customer.id,
          customerNumber: input.customer.customerNumber,
          salutation: input.customer.salutation,
          company: input.customer.company,
          firstName: input.customer.firstName,
          lastName: input.customer.lastName,
          street: input.customer.street,
          zip: input.customer.zip,
          city: input.customer.city,
          email: input.customer.email
        }
      : null,
    vehicle: input.vehicle
      ? {
          id: input.vehicle.id,
          make: input.vehicle.make,
          model: input.vehicle.model,
          licensePlate: input.vehicle.licensePlate,
          firstRegistration: input.vehicle.firstRegistration,
          mileageKm: input.vehicle.mileageKm,
          vin: input.vehicle.vin,
          nextHu: input.vehicle.nextHu,
          displacementCcm: input.vehicle.displacementCcm,
          powerKw: input.vehicle.powerKw,
          hsn: input.vehicle.hsn,
          tsn: input.vehicle.tsn
        }
      : null,
    settings: {
      name: input.settings.companyName,
      owner: input.settings.owner,
      street: input.settings.street,
      zip: input.settings.zip,
      city: input.settings.city,
      email: input.settings.email,
      phone: input.settings.phone,
      mobile: input.settings.mobile,
      fax: input.settings.fax,
      website: input.settings.website,
      vatId: input.settings.vatId,
      taxNumber: input.settings.taxNumber,
      bankName: input.settings.bankName,
      iban: input.settings.iban,
      bic: input.settings.bic,
      logoMime: input.settings.logoMime,
      // Hash a digest of the logo, not its bytes — keeps the canonical
      // JSON tiny while still invalidating when the logo changes.
      logoHash: input.settings.logoData
        ? createHash('sha256').update(input.settings.logoData).digest('hex')
        : null,
      pdfFooter: input.settings.pdfFooter,
      smallBusiness: input.settings.smallBusinessExempt
    }
  })
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

/* ------------------------------------------------------------------ */
/* Renderer                                                           */
/* ------------------------------------------------------------------ */

const documentTypeLabelDe = (type: string): string => {
  switch (type) {
    case 'invoice':
      return 'Rechnung'
    case 'offer':
      return 'Angebot'
    case 'cost_estimate':
      return 'Kostenvoranschlag'
    case 'order_confirmation':
      return 'Auftragsbestätigung'
    case 'reminder':
      return 'Zahlungserinnerung'
    default:
      return type
  }
}

/* ------------------------------------------------------------------ */
/* Renderer helpers                                                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* WinAnsi-safe text + wrapping helpers                                */
/* ------------------------------------------------------------------ */

/**
 * Code points of the CP1252 "extra" block (0x80–0x9F) that WinAnsi maps
 * to real glyphs — €, typographic quotes, dashes, ellipsis, Š/Ž/Œ etc.
 * Together with printable ASCII (0x20–0x7E) and the Latin-1 supplement
 * (0xA0–0xFF) this is everything the 14 standard PDF fonts can encode.
 */
const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178
])

const isWinAnsiEncodable = (cp: number): boolean =>
  (cp >= 0x20 && cp <= 0x7e) ||
  (cp >= 0xa0 && cp <= 0xff) ||
  WIN_ANSI_EXTRA.has(cp)

/**
 * Explicit fallbacks for letters that NFKD cannot decompose to an
 * encodable base character (stroked/serbo-croatian/turkish letters and
 * a few typographic symbols). Values must themselves be WinAnsi-safe.
 */
const WIN_ANSI_FOLDS: Record<string, string> = {
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ħ: 'h',
  Ħ: 'H',
  ı: 'i',
  ẞ: 'SS',
  '№': 'Nr.',
  '−': '-'
}

/**
 * Make a string safe for pdf-lib's StandardFonts (WinAnsi encoding).
 *
 * Replacement policy, in order:
 * 1. Encodable code points pass through unchanged (umlauts, ß, €, § …).
 * 2. A small explicit fold map handles letters without a decomposable
 *    base (ł → l, Đ → D, ẞ → SS, …).
 * 3. Everything else is NFKD-decomposed and stripped of combining
 *    marks; if the base character is encodable it is kept (ő → o,
 *    č → c, á → á-via-NFC-composition-loss → a …).
 * 4. Characters with no encodable representation become `?` so the
 *    render never throws — a visibly wrong glyph beats a 500.
 *
 * Newlines are preserved (`\r\n`/`\r` normalized to `\n`), tabs become
 * a single space.
 */
export const sanitizeWinAnsiText = (value: string): string => {
  const normalized = (value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/\t/g, ' ')
  let out = ''
  for (const ch of normalized) {
    const cp = ch.codePointAt(0) ?? 0
    if (ch === '\n' || isWinAnsiEncodable(cp)) {
      out += ch
      continue
    }
    const folded = WIN_ANSI_FOLDS[ch]
    if (folded !== undefined) {
      out += folded
      continue
    }
    const base = ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    let kept = ''
    for (const b of base) {
      if (b === '\n' || isWinAnsiEncodable(b.codePointAt(0) ?? 0)) kept += b
    }
    out += kept || '?'
  }
  return out
}

/**
 * Exact greedy word wrap for a WinAnsi font: splits on `\n` first, then
 * wraps words at `maxWidth` measured via `font.widthOfTextAtSize`.
 * Words wider than the column are hard-broken character by character so
 * a single unbreakable token (long part numbers, URLs) can never bleed
 * into a neighbouring column. Always returns at least one line.
 */
export const wrapTextLines = (
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] => {
  const sanitized = sanitizeWinAnsiText(value ?? '')
  const lines: string[] = []
  for (const paragraph of sanitized.split('\n')) {
    const words = paragraph.split(' ').filter((w) => w.length > 0)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate
        continue
      }
      if (line) {
        lines.push(line)
        line = ''
      }
      // Hard-break a word that alone exceeds the column width.
      let rest = word
      while (rest.length > 1 && font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1
        while (
          cut > 1 &&
          font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth
        ) {
          cut -= 1
        }
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      line = rest
    }
    if (line) lines.push(line)
  }
  return lines.length > 0 ? lines : ['']
}

/**
 * Single-line fit: returns the (sanitized) string unchanged when it
 * fits `maxWidth`, otherwise truncates with a `…` ellipsis. Newlines
 * collapse to spaces — this is for one-line labels, not paragraphs.
 */
export const fitTextToWidth = (
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string => {
  const sanitized = sanitizeWinAnsiText(value ?? '').replace(/\n/g, ' ')
  if (font.widthOfTextAtSize(sanitized, size) <= maxWidth) return sanitized
  let t = sanitized
  while (
    t.length > 1 &&
    font.widthOfTextAtSize(`${t.trimEnd()}…`, size) > maxWidth
  ) {
    t = t.slice(0, -1)
  }
  return `${t.trimEnd()}…`
}

/**
 * Shrink a font size (integer steps) until `value` fits `maxWidth`,
 * bounded by `minSize`. Callers still pass the result through
 * {@link fitTextToWidth} for the pathological case where even
 * `minSize` does not fit.
 */
const shrinkFontSize = (
  value: string,
  font: PDFFont,
  maxSize: number,
  minSize: number,
  maxWidth: number
): number => {
  const sanitized = sanitizeWinAnsiText(value ?? '').replace(/\n/g, ' ')
  let size = maxSize
  while (size > minSize && font.widthOfTextAtSize(sanitized, size) > maxWidth) {
    size -= 1
  }
  return size
}

/** German item-kind letter as shown in the legacy "Kfz-Kaufmann" output. */
const itemKindLetter = (kind: string | null | undefined): string => {
  switch (kind) {
    case 'service':
      return 'L'
    case 'material':
      return 'M'
    case 'article':
      return 'A'
    case 'pass_through':
      return 'D'
    default:
      return ''
  }
}

const documentIntroLine = (type: string): string => {
  switch (type) {
    case 'invoice':
      return 'Gemäss Ihres Auftrages berechnen wir wie folgt:'
    case 'order_confirmation':
      return 'Wir bestätigen Ihnen Ihren Auftrag wie folgt:'
    default:
      // offer / cost_estimate share the same intro
      return 'Wir danken für Ihre Anfrage und bieten wie folgt an:'
  }
}

const documentClosingLine = (type: string): string => {
  if (type === 'invoice') {
    return 'Wir bedanken uns für Ihren Auftrag und wünschen allzeit gute Fahrt!'
  }
  return 'Wir bedanken uns für Ihren Auftrag und freuen uns auch weiterhin auf eine gute Zusammenarbeit!'
}

/** Customer salutation line ("Firma", "Herr", "Frau"). */
const customerHeading = (cust: Customer | null): string => {
  if (!cust) return ''
  if (cust.salutation) return cust.salutation
  if (cust.company) return 'Firma'
  return 'Herr/Frau'
}

const customerName = (cust: Customer | null): string => {
  if (!cust) return ''
  if (cust.company) return cust.company
  return `${cust.firstName ?? ''} ${cust.lastName ?? ''}`.trim() || '-'
}

/** "MM/YY" from a YYYY-MM-DD date — used for Erstzulassung. */
const monthYear = (s: string | null | undefined): string => {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[2]}/${m[1].slice(2)}` : s
}

/** "MM.YYYY" from a YYYY-MM-DD date — used for nextHu. */
const monthYearFull = (s: string | null | undefined): string => {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[2]}.${m[1]}` : s
}

/* ------------------------------------------------------------------ */
/* Renderer                                                           */
/* ------------------------------------------------------------------ */

/**
 * Render an A4 PDF for the given document. The layout closely mirrors
 * the legacy "Kfz-Kaufmann" Access output (see `Daten/beispiel-rechnung.pdf`)
 * so existing customers can switch over without their documents looking
 * unfamiliar:
 *
 * - Logo top-left, full company contact block top-right (right-aligned).
 * - Return-to-sender tag line above the customer address block.
 * - Vehicle info block in italic between customer and items table.
 * - Right-aligned document title with Seite / Datum / Nummer / Kdnr.
 * - Items table with kind-letter prefix (L / M / A / D), Art-Nr, qty
 *   + unit, description (multi-line), Einzelpreis, Gesamtpreis.
 * - Totals box right-aligned with Leistung / Material / Artikel split,
 *   AT-Steuer, MwSt %, Zwischensumme, durchlaufende Posten and a bold
 *   Gesamtbetrag with double underline.
 * - "Zahlbar bis …" line for invoices.
 * - Standard German closing text + optional user PDF footer.
 *
 * Multi-page support: items overflow onto follow-up pages that repeat a
 * slim header (company name, doc title, page number) and the items
 * table head. Page breaks are row-level (a row never renders half; only
 * rows taller than an entire page body split line-wise), the totals
 * block is measured up front and moves to a fresh page in one piece
 * when it no longer fits, and every page carries a footer rule with
 * company / document reference and "Seite X von Y".
 *
 * Robustness: all text passes through {@link sanitizeWinAnsiText}
 * (StandardFonts are WinAnsi-only — unsupported characters degrade to a
 * documented replacement instead of throwing), long header/address
 * values wrap or ellipsize inside their columns, and the output is
 * byte-deterministic for identical input (PDF dates derive from
 * `doc.updatedAt`).
 */
export const renderDocumentPdf = async (
  input: DocumentRenderInput
): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create()
  // GoBD-Storno (§ 14 UStG): eine Storno-Rechnung ist immer noch
  // `type='invoice'`, der Discriminator hängt am Status. Wir schalten
  // hier den sichtbaren Titel um — "STORNORECHNUNG" plus den Hinweis
  // auf die negierte Original-Belegnummer (falls im Input enthalten).
  const isStorno = input.doc.type === 'invoice' && input.doc.status === 'storno'
  const titleLabel = isStorno
    ? 'STORNORECHNUNG'
    : documentTypeLabelDe(input.doc.type)
  // PDF metadata — feeds into `Document Properties` in the viewer and is
  // a fallback source for the suggested download filename in browsers
  // that ignore URL fragments.
  pdf.setTitle(`${titleLabel} ${input.doc.documentNumber}`)
  pdf.setProducer('TwinCarsManager')
  if (input.settings.companyName) pdf.setAuthor(input.settings.companyName)
  // Deterministic metadata: derive both PDF dates from the document's
  // own `updatedAt` instead of wall-clock time so re-rendering the same
  // input yields byte-identical output (visual regression + caching).
  // pdf-lib otherwise stamps `new Date()` into /CreationDate AND
  // /ModDate on `PDFDocument.create()`.
  const metaDate =
    input.doc.updatedAt instanceof Date ? input.doc.updatedAt : new Date(0)
  pdf.setCreationDate(metaDate)
  pdf.setModificationDate(metaDate)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const fontBoldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique)

  /* — Embed logo (PNG / JPEG) once if available — */
  let logoImage:
    | Awaited<ReturnType<typeof pdf.embedPng>>
    | Awaited<ReturnType<typeof pdf.embedJpg>>
    | null = null
  if (input.settings.logoData && input.settings.logoMime) {
    try {
      const m = /^data:([^;]+);base64,(.+)$/.exec(input.settings.logoData)
      const mime = m ? m[1] : input.settings.logoMime
      const base64 = m ? m[2] : input.settings.logoData
      const bytes = Buffer.from(base64, 'base64')
      if (/png/i.test(mime)) {
        logoImage = await pdf.embedPng(bytes)
      } else if (/jpe?g/i.test(mime)) {
        logoImage = await pdf.embedJpg(bytes)
      }
      // SVG is not natively supported; we silently fall back to text-only
      // header in that case.
    } catch {
      logoImage = null
    }
  }

  // A4 in points
  const PAGE_W = 595.28
  const PAGE_H = 841.89
  const ml = 50
  const mr = 50
  const innerW = PAGE_W - ml - mr
  const co = input.settings
  const cust = input.customer
  const veh = input.vehicle
  const docType = input.doc.type
  const title = titleLabel

  /* ── Layout helper closures bind to the current page ────────────── */

  /** Returns text drawing helpers + line/rect drawing for the given page. */
  const surface = (page: PDFPage) => {
    const { width: w, height: h } = page.getSize()
    const text = (
      s: string,
      x: number,
      yy: number,
      opts: {
        size?: number
        font?: PDFFont
        color?: [number, number, number]
        width?: number
        align?: 'left' | 'right'
        lineHeight?: number
      } = {}
    ) => {
      const f = opts.font ?? font
      const size = opts.size ?? 10
      // Sanitize at the draw boundary so user-supplied strings can
      // never hit WinAnsi encoding errors inside pdf-lib.
      const safe = sanitizeWinAnsiText(s)
      let drawX = x
      if (opts.align === 'right') {
        const tw = f.widthOfTextAtSize(safe, size)
        drawX = x - tw
      }
      page.drawText(safe, {
        x: drawX,
        y: yy,
        size,
        font: f,
        color: rgb(...(opts.color ?? [0, 0, 0])),
        maxWidth: opts.width,
        lineHeight: opts.lineHeight
      })
    }
    const hr = (
      yy: number,
      thick = 0.5,
      color: [number, number, number] = [0.7, 0.7, 0.7]
    ) =>
      page.drawLine({
        start: { x: ml, y: yy },
        end: { x: w - mr, y: yy },
        thickness: thick,
        color: rgb(...color)
      })
    const measure = (s: string, size: number, f: PDFFont = font) =>
      f.widthOfTextAtSize(sanitizeWinAnsiText(s), size)
    return { page, w, h, text, hr, measure }
  }

  /**
   * Items column geometry — fixed across pages.
   *
   *   K | ArtNr | Anz Unit | Beschreibung … | Einzel | Gesamt
   *   8   55      75         flex             80       80
   */
  const cols = {
    kindX: ml + 4,
    artX: ml + 16,
    qtyX: ml + 70,
    unitX: ml + 100,
    descX: ml + 130,
    priceRight: ml + innerW - 90,
    totalRight: ml + innerW - 5
  }
  const descMaxW = cols.priceRight - 80 - cols.descX

  /**
   * The y-coordinate of the "Seite n von N" line per page. We patch the
   * total-pages placeholder once we know the final count.
   */
  const pageNoLineYs: number[] = []

  /** Draw the full first-page header block. Returns the y where body starts. */
  const drawFirstPageHeader = (page: PDFPage): number => {
    const s = surface(page)
    const top = PAGE_H - 40

    /* Logo (left) — keep aspect ratio, fit into ~210×60 box. */
    if (logoImage) {
      const maxW = 210
      const maxH = 70
      const r = Math.min(maxW / logoImage.width, maxH / logoImage.height)
      const dw = logoImage.width * r
      const dh = logoImage.height * r
      page.drawImage(logoImage, { x: ml, y: top - dh, width: dw, height: dh })
    } else {
      // Text fallback: company name big, width-limited so it can never
      // run into the right-aligned contact block.
      s.text(
        fitTextToWidth(co.companyName || 'Firma', fontBold, 14, 220),
        ml,
        top - 14,
        { size: 14, font: fontBold }
      )
    }

    /* Right column: company contact block, fully right-aligned. Every
       line is width-limited (ellipsis) so extreme settings values can
       never overlap the logo / left header column. */
    let ry = top
    const rightX = PAGE_W - mr
    const RIGHT_BLOCK_MAX_W = 262
    const coNameSize = shrinkFontSize(
      co.companyName || 'Firma',
      fontBold,
      14,
      10,
      RIGHT_BLOCK_MAX_W
    )
    s.text(
      fitTextToWidth(
        co.companyName || 'Firma',
        fontBold,
        coNameSize,
        RIGHT_BLOCK_MAX_W
      ),
      rightX,
      ry,
      { size: coNameSize, font: fontBold, align: 'right' }
    )
    ry -= 16
    const rightLine = (line: string) => {
      s.text(fitTextToWidth(line, font, 9, RIGHT_BLOCK_MAX_W), rightX, ry, {
        size: 9,
        align: 'right'
      })
      ry -= 11
    }
    if (co.owner) rightLine(`KFZ Meisterbetrieb Inh. ${co.owner}`)
    rightLine(co.street)
    rightLine(`${co.zip} ${co.city}`.trim())
    if (co.phone) rightLine(`Tel: ${co.phone}`)
    if (co.mobile) rightLine(`Mobil: ${co.mobile}`)
    if (co.fax) rightLine(`Fax: ${co.fax}`)
    if (co.email) rightLine(`Email: ${co.email}`)
    if (co.website) rightLine(co.website.replace(/^https?:\/\//, ''))
    if (co.vatId) rightLine(`Ust.ID.Nr.: ${co.vatId}`)
    if (co.taxNumber) rightLine(`St.Nr.: ${co.taxNumber}`)
    if (co.bankName) rightLine(co.bankName)
    if (co.bic) rightLine(`BIC: ${co.bic}`)
    if (co.iban) rightLine(`IBAN: ${co.iban}`)

    /* Customer block (left, below the logo) — the DIN-style address
       window. Long names / streets wrap inside the window width instead
       of running under the right meta column. */
    const ADDRESS_MAX_W = 250
    let cy = top - 90
    if (logoImage) cy = top - 110
    // Return-to-sender mini line, slightly underlined.
    if (cust && (co.companyName || co.street || co.city)) {
      const rts = fitTextToWidth(
        `${co.companyName} ° ${co.street} ° ${co.zip} ${co.city}`.trim(),
        font,
        7,
        ADDRESS_MAX_W
      )
      s.text(rts, ml, cy, { size: 7, color: [0.3, 0.3, 0.3] })
      const rtsW = s.measure(rts, 7)
      page.drawLine({
        start: { x: ml, y: cy - 1 },
        end: { x: ml + rtsW, y: cy - 1 },
        thickness: 0.3,
        color: rgb(0.4, 0.4, 0.4)
      })
      cy -= 12
    }
    const addressLine = (value: string) => {
      for (const line of wrapTextLines(value, font, 10, ADDRESS_MAX_W)) {
        s.text(line, ml, cy, { size: 10 })
        cy -= 12
      }
    }
    if (cust) {
      s.text(customerHeading(cust), ml, cy, { size: 10 })
      cy -= 12
      addressLine(customerName(cust))
      if (cust.street) addressLine(cust.street)
      if (cust.zip || cust.city) {
        addressLine(`${cust.zip ?? ''} ${cust.city ?? ''}`.trim())
      }
    } else {
      s.text('Kein Kunde hinterlegt', ml, cy, {
        size: 10,
        color: [0.6, 0.6, 0.6]
      })
      cy -= 12
    }

    /* Vehicle block (left, italic, two columns). Column A is fitted to
       the column-B boundary so long make/model or VIN strings cannot
       collide with the second column. */
    let vy = Math.min(cy - 24, ry - 30)
    if (veh) {
      const colA = ml
      const colB = ml + 200
      const colAMaxW = colB - colA - 8
      // Column B may not run under the right-aligned title/meta
      // block (starts ~x 385) — cap it well short of that.
      const colBMaxW = 130
      const txt = (s2: string, x: number, yy: number, maxW: number) =>
        s.text(fitTextToWidth(s2, fontItalic, 9, maxW), x, yy, {
          size: 9,
          font: fontItalic
        })
      const kfzTyp = `${veh.make ?? ''} ${veh.model ?? ''}`.trim() || '-'
      txt(`Kfz-Typ: ${kfzTyp}`, colA, vy, colAMaxW)
      if (veh.displacementCcm)
        txt(`Hubraum: ${veh.displacementCcm}`, colB, vy, colBMaxW)
      vy -= 11
      if (veh.licensePlate)
        txt(`Kennzeichen: ${veh.licensePlate}`, colA, vy, colAMaxW)
      if (veh.powerKw) txt(`Kw: ${veh.powerKw}`, colB, vy, colBMaxW)
      vy -= 11
      if (veh.firstRegistration)
        txt(
          `Erstzulassung: ${monthYear(veh.firstRegistration)}`,
          colA,
          vy,
          colAMaxW
        )
      if (veh.hsn || veh.tsn)
        txt(`zu2: ${veh.hsn ?? ''} zu3: ${veh.tsn ?? ''}`, colB, vy, colBMaxW)
      vy -= 11
      if (veh.mileageKm != null)
        txt(`km-Stand: ${veh.mileageKm}`, colA, vy, colAMaxW)
      if (input.doc.serviceDate)
        txt(
          `Leistungsdatum: ${formatDate(input.doc.serviceDate)}`,
          colB,
          vy,
          colBMaxW
        )
      vy -= 11
      if (veh.vin) txt(`Kfz-Ident.Nr.: ${veh.vin}`, colA, vy, colAMaxW)
      vy -= 11
      if (veh.nextHu)
        txt(`HU: ${monthYearFull(veh.nextHu)}`, colA, vy, colAMaxW)
      vy -= 11
    }

    /* Document title block (right). */
    let ty = ry - 30
    s.text(title, rightX, ty, {
      size: 22,
      font: fontBoldItalic,
      align: 'right'
    })
    ty -= 22
    // GoBD-Storno: unter dem Titel den Bezug auf die Original-Rechnung
    // ausweisen, damit der Steuerberater/Prüfer den Zusammenhang ohne
    // zusätzlichen Klick sieht. Wir extrahieren die Originalnummer aus
    // dem `notes`-Feld, das `cancelInvoice` mit "Stornorechnung zu
    // <Nr>" befüllt.
    if (isStorno) {
      const match = /Stornorechnung zu (\S+)/.exec(input.doc.notes ?? '')
      // `cancelInvoice` writes "Stornorechnung zu <Nr>. Grund: …" — the
      // sentence period is not part of the document number.
      const reference = match ? match[1].replace(/[.,;:]+$/, '') : null
      if (reference) {
        s.text(`zu Rechnung ${reference}`, rightX, ty, {
          size: 10,
          font: fontBoldItalic,
          align: 'right'
        })
        ty -= 14
      }
    }
    // Page n von N is drawn in the final patch pass once we know N.
    pageNoLineYs.push(ty)
    ty -= 12
    const dateLabel = docType === 'invoice' ? 'Rechnungsdatum:' : 'Datum:'
    s.text(`${dateLabel}  ${formatDate(input.doc.issueDate)}`, rightX, ty, {
      size: 9,
      font: fontItalic,
      align: 'right'
    })
    ty -= 12
    const numLabel = docType === 'invoice' ? 'Rechnungsnummer:' : 'Nummer:'
    s.text(`${numLabel}  ${input.doc.documentNumber}`, rightX, ty, {
      size: 10,
      font: fontBold,
      align: 'right'
    })
    ty -= 12
    if (cust?.customerNumber) {
      s.text(`Kundennummer:  ${cust.customerNumber}`, rightX, ty, {
        size: 9,
        font: fontItalic,
        align: 'right'
      })
      ty -= 12
    }
    if (input.doc.paymentMethod) {
      s.text(
        fitTextToWidth(input.doc.paymentMethod, fontItalic, 9, 220),
        rightX,
        ty,
        { size: 9, font: fontItalic, align: 'right' }
      )
      ty -= 12
    }

    /* Intro line. */
    let y = Math.min(vy, ty) - 14
    s.text(documentIntroLine(docType), ml, y, { size: 10 })
    y -= 8

    /* Optional user Kopftext (doc.header) — wrapped paragraph between
       the intro line and the items table. */
    if (input.doc.header) {
      y -= 6
      for (const line of wrapTextLines(input.doc.header, font, 10, innerW)) {
        s.text(line, ml, y, { size: 10 })
        y -= 12
      }
      y += 4
    }
    return y
  }

  /** Slim header for follow-up pages (page 2+). */
  const drawContinuationHeader = (page: PDFPage): number => {
    const s = surface(page)
    const top = PAGE_H - 40
    s.text(co.companyName || 'Firma', ml, top, { size: 11, font: fontBold })
    s.text(`${title} ${input.doc.documentNumber}`, PAGE_W - mr, top, {
      size: 10,
      font: fontBoldItalic,
      align: 'right'
    })
    pageNoLineYs.push(top - 12)
    return top - 30
  }

  /** Items table column header. */
  const drawItemsTableHeader = (page: PDFPage, y: number): number => {
    const s = surface(page)
    s.text('Art Nr', cols.artX, y, { size: 9, font: fontItalic })
    s.text('Anz.', cols.qtyX, y, { size: 9, font: fontItalic })
    s.text('Artikelbeschreibung', cols.descX, y, { size: 9, font: fontItalic })
    s.text('Einzelpreis', cols.priceRight, y, {
      size: 9,
      font: fontItalic,
      align: 'right'
    })
    s.text('Gesamtpreis', cols.totalRight, y, {
      size: 9,
      font: fontItalic,
      align: 'right'
    })
    s.hr(y - 4)
    return y - 16
  }

  /* ── Pagination ─────────────────────────────────────────────────── */

  const lineHeight = 12

  // Bottom geometry: every page reserves a footer zone (thin rule +
  // company / doc line + "Seite X von Y"), drawn in the final patch
  // pass once the total page count is known.
  const FOOTER_RULE_Y = 58
  const BODY_BOTTOM = 76
  const TOTALS_BOTTOM = 68

  const pages: PDFPage[] = []

  // First page: render header and start placing items.
  let page = pdf.addPage([PAGE_W, PAGE_H])
  pages.push(page)
  let y = drawFirstPageHeader(page)
  y -= 6
  y = drawItemsTableHeader(page, y)

  /** Open a fresh continuation page; optionally repeat the table head. */
  const newBodyPage = (withTableHeader: boolean): void => {
    page = pdf.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    y = drawContinuationHeader(page)
    if (withTableHeader) y = drawItemsTableHeader(page, y)
  }

  // Body capacity of a fresh continuation page — decides whether a row
  // moves to the next page as a whole or (only when taller than an
  // entire page body) must split line-wise.
  const CONT_BODY_TOP = PAGE_H - 40 - 30 - 16 // slim header + table head
  const FRESH_PAGE_CAPACITY = CONT_BODY_TOP - BODY_BOTTOM

  /* — Items table: exact greedy wrap (same measurement the renderer
       draws with), row-level page breaks. A row that no longer fits
       moves to the next page as a whole; a per-line "abzügl. x %
       Rabatt" note is appended for discounted positions. — */
  type RowLine = { text: string; muted?: boolean }
  const rowLinesFor = (it: DocumentItem): RowLine[] => {
    const lines: RowLine[] = wrapTextLines(
      it.description,
      font,
      9,
      descMaxW
    ).map((text) => ({ text }))
    const discount = Number(it.discountPercent)
    if (Number.isFinite(discount) && discount > 0) {
      lines.push({
        text: `abzügl. ${formatPercentDe(discount)} % Rabatt`,
        muted: true
      })
    }
    return lines
  }

  for (const it of input.items) {
    const lines = rowLinesFor(it)
    const rowH = lines.length * lineHeight
    if (y - rowH < BODY_BOTTOM && rowH <= FRESH_PAGE_CAPACITY) {
      newBodyPage(true)
    }
    let first = true
    for (const line of lines) {
      // Only rows taller than a whole page body ever hit this mid-row
      // break — everything else was moved above in one piece.
      if (y < BODY_BOTTOM) newBodyPage(true)
      const s = surface(page)
      if (first) {
        const letter = itemKindLetter(it.kind)
        if (letter)
          s.text(letter, cols.kindX, y, { size: 8, color: [0.3, 0.3, 0.3] })
        if (it.articleNumber)
          s.text(
            fitTextToWidth(
              it.articleNumber,
              font,
              9,
              cols.qtyX - cols.artX - 6
            ),
            cols.artX,
            y,
            { size: 9 }
          )
        const qtyText = formatQty(it.quantity)
        const qtyColW = cols.unitX - cols.qtyX - 4
        if (font.widthOfTextAtSize(qtyText, 9) <= qtyColW) {
          s.text(qtyText, cols.qtyX, y, { size: 9 })
          s.text(
            fitTextToWidth(it.unit ?? '', font, 9, cols.descX - cols.unitX - 4),
            cols.unitX,
            y,
            { size: 9 }
          )
        } else {
          // Very wide quantity: draw "qty unit" as one fitted string
          // across both sub-columns instead of overlapping the unit.
          s.text(
            fitTextToWidth(
              `${qtyText} ${it.unit ?? ''}`.trim(),
              font,
              9,
              cols.descX - cols.qtyX - 4
            ),
            cols.qtyX,
            y,
            { size: 9 }
          )
        }
        s.text(formatEur(it.unitPriceNet), cols.priceRight, y, {
          size: 9,
          align: 'right'
        })
        s.text(formatEur(it.lineTotalGross), cols.totalRight, y, {
          size: 9,
          align: 'right'
        })
      }
      if (line.muted) {
        s.text(line.text, cols.descX, y, {
          size: 9,
          font: fontItalic,
          color: [0.35, 0.35, 0.35]
        })
      } else {
        s.text(line.text, cols.descX, y, { size: 9 })
      }
      y -= lineHeight
      first = false
    }
  }

  /* — Totals box + closing: measured first, kept together. When the
       block no longer fits under the last item row it moves to a fresh
       continuation page in one piece — totals are never split. — */

  const sumByKind = (k: string) =>
    input.items
      .filter((i) => i.kind === k)
      .reduce((acc, i) => acc + Number(i.lineTotalNet), 0)
  const leistung = sumByKind('service')
  const material = sumByKind('material')
  const artikel = sumByKind('article')
  const passThrough = sumByKind('pass_through')
  const discountTotal = Number(input.doc.discountTotal)

  // Per-rate VAT lines: a document with mixed item tax rates gets one
  // MwSt row per rate (the doc-level `taxRate` is just the first
  // item's rate and would misrepresent the split); the single-rate
  // case keeps the legacy one-line output.
  const rateGroups = new Map<number, { net: number; tax: number }>()
  for (const it of input.items) {
    if (it.kind === 'pass_through') continue
    const rate = Number(it.taxRate)
    if (!Number.isFinite(rate)) continue
    const net = Number(it.lineTotalNet)
    const tax = Number(it.lineTotalGross) - net
    const group = rateGroups.get(rate) ?? { net: 0, tax: 0 }
    group.net += Number.isFinite(net) ? net : 0
    group.tax += Number.isFinite(tax) ? tax : 0
    rateGroups.set(rate, group)
  }
  const distinctRates = [...rateGroups.entries()].sort((a, b) => a[0] - b[0])

  type TotalsRow = {
    label: string
    value: string
    bold?: boolean
    italic?: boolean
    size?: number
    underline?: boolean
    gapBefore?: number
  }
  const totalsRows: TotalsRow[] = []
  if (input.settings.smallBusinessExempt) {
    totalsRows.push({
      label: 'Gesamtbetrag:',
      value: formatEur(input.doc.grossTotal),
      bold: true,
      underline: true,
      gapBefore: 4
    })
  } else {
    totalsRows.push({
      label: 'Summe MwStpflichtiger Positionen:',
      value: formatEur(input.doc.netTotal),
      italic: true,
      size: 9
    })
    if (distinctRates.length > 1) {
      for (const [rate, group] of distinctRates) {
        totalsRows.push({
          label: `zzgl. MwSt. ${formatPercentDe(rate)} % auf ${formatEur(group.net)}:`,
          value: formatEur(group.tax),
          italic: true,
          size: 9
        })
      }
    } else {
      totalsRows.push({
        label: `zzgl. AT Steuer: ${formatEur(0)}      zzgl. MwSt. ${Number(input.doc.taxRate)} %`,
        value: formatEur(input.doc.taxTotal),
        italic: true,
        size: 9
      })
    }
    totalsRows.push({
      label: 'Zwischensumme:',
      value: formatEur(input.doc.grossTotal),
      italic: true,
      size: 9
    })
    totalsRows.push({
      label: 'Summe durchlaufender Posten:',
      value: formatEur(passThrough),
      italic: true,
      size: 9
    })
    totalsRows.push({
      label: 'Gesamtbetrag:',
      value: formatEur(input.doc.grossTotal),
      bold: true,
      italic: true,
      size: 11,
      underline: true,
      gapBefore: 4
    })
  }

  // Rails: the label column keeps its legacy x-position but yields
  // further left when very large amounts need the room, so values can
  // never overprint their labels.
  const valueRight = cols.totalRight
  const totalsFontFor = (row: TotalsRow): PDFFont =>
    row.bold
      ? row.italic
        ? fontBoldItalic
        : fontBold
      : row.italic
        ? fontItalic
        : font
  const measureTotals = (s2: string, size: number, f: PDFFont) =>
    f.widthOfTextAtSize(sanitizeWinAnsiText(s2), size)
  const maxValueW = totalsRows.reduce(
    (acc, row) =>
      Math.max(
        acc,
        measureTotals(row.value, row.size ?? 10, totalsFontFor(row))
      ),
    0
  )
  const labelRight = Math.min(cols.priceRight, valueRight - maxValueW - 12)
  const minLabelStartX = totalsRows.reduce(
    (acc, row) =>
      Math.min(
        acc,
        labelRight -
          measureTotals(row.label, row.size ?? 10, totalsFontFor(row))
      ),
    labelRight
  )

  // Left-hand info stack (kind split + discount note): rendered beside
  // the totals rail, stacked above it when the two would collide.
  const leftLines: string[] = []
  if (leistung || material || artikel) {
    leftLines.push(
      `Leistung: ${formatEur(leistung)}    Material: ${formatEur(material)}    Artikel: ${formatEur(artikel)}`
    )
  }
  if (Number.isFinite(discountTotal) && discountTotal > 0) {
    leftLines.push(`enthaltener Rabatt: ${formatEur(discountTotal)}`)
  }
  const maxLeftW = leftLines.reduce(
    (acc, line) => Math.max(acc, measureTotals(line, 9, font)),
    0
  )
  const leftCollides = ml + maxLeftW + 12 > minLabelStartX

  const customFooter = input.doc.footer || co.pdfFooter
  const footerLines = customFooter
    ? wrapTextLines(customFooter, font, 10, innerW)
    : []
  const noteLines = input.settings.smallBusinessExempt
    ? wrapTextLines(
        'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.',
        fontItalic,
        9,
        innerW
      )
    : []

  /**
   * Draw (or, with `target === null`, only measure) the totals block +
   * closing texts starting at `startY`. Returns the y below the block —
   * the measure pass feeds the keep-together decision.
   */
  const renderTotalsBlock = (
    target: PDFPage | null,
    startY: number
  ): number => {
    const s = target ? surface(target) : null
    let ty = startY
    s?.hr(ty)
    ty -= 14
    if (leftCollides) {
      for (const line of leftLines) {
        s?.text(line, ml, ty, { size: 9 })
        ty -= 12
      }
      if (leftLines.length > 0) ty -= 2
    } else {
      let ly = ty
      for (const line of leftLines) {
        s?.text(line, ml, ly, { size: 9 })
        ly -= 12
      }
    }
    for (const row of totalsRows) {
      if (row.gapBefore) ty -= row.gapBefore
      const size = row.size ?? 10
      const f = totalsFontFor(row)
      s?.text(row.label, labelRight, ty, { size, font: f, align: 'right' })
      s?.text(row.value, valueRight, ty, { size, font: f, align: 'right' })
      ty -= 14
      if (row.underline) {
        // Double underline under the Gesamtbetrag value, sized to it.
        const vw = measureTotals(row.value, size, f)
        const lineW = Math.max(70, vw + 4)
        const offsets = size >= 11 ? [12, 10] : [11, 9]
        for (const off of offsets) {
          target?.drawLine({
            start: { x: valueRight - lineW, y: ty + off },
            end: { x: valueRight, y: ty + off },
            thickness: 0.6,
            color: rgb(0, 0, 0)
          })
        }
        ty -= 6
      }
    }
    if (noteLines.length > 0) {
      for (const line of noteLines) {
        s?.text(line, ml, ty, {
          size: 9,
          font: fontItalic,
          color: [0.4, 0.4, 0.4]
        })
        ty -= 12
      }
      ty -= 6
    }
    /* "Zahlbar bis …" for invoices. */
    if (docType === 'invoice' && input.doc.dueDate) {
      s?.text(
        `Zahlbar bis zum ${formatDate(input.doc.dueDate)} ohne Abzug`,
        ml,
        ty,
        { size: 10 }
      )
      ty -= 18
    }
    /* User-supplied footer text (Werbe-/Endtext). */
    for (const line of footerLines) {
      s?.text(line, ml, ty, { size: 10 })
      ty -= 12
    }
    if (footerLines.length > 0) ty -= 6
    /* Standard German closing. */
    s?.text(documentClosingLine(docType), ml, ty, {
      size: 10,
      font: fontItalic
    })
    ty -= 14
    s?.text(
      'Der Gesetzgeber schreibt vor, für private Personen die Rechnung 2 Jahre aufzubewahren!',
      ml,
      ty,
      { size: 10, font: fontItalic }
    )
    ty -= 12
    return ty
  }

  const totalsHeight = y - renderTotalsBlock(null, y)
  if (y - totalsHeight < TOTALS_BOTTOM) {
    newBodyPage(false)
  }
  renderTotalsBlock(page, y)

  /* — Final patch pass: the top "Seite X von N" meta lines (positions
       stashed during header rendering) plus a footer rule with the
       company / document line and page number on EVERY page. — */
  const totalPages = pages.length
  for (let i = 0; i < pages.length; i++) {
    const ps = surface(pages[i])
    ps.text(`Seite ${i + 1} von ${totalPages}`, PAGE_W - mr, pageNoLineYs[i], {
      size: 9,
      font: fontItalic,
      align: 'right'
    })
    ps.hr(FOOTER_RULE_Y, 0.5, [0.75, 0.75, 0.75])
    const pageLabel = `Seite ${i + 1} von ${totalPages}`
    ps.text(pageLabel, PAGE_W - mr, FOOTER_RULE_Y - 12, {
      size: 8,
      color: [0.45, 0.45, 0.45],
      align: 'right'
    })
    const pageLabelW = font.widthOfTextAtSize(pageLabel, 8)
    ps.text(
      fitTextToWidth(
        `${co.companyName ?? ''} · ${title} ${input.doc.documentNumber}`,
        font,
        8,
        innerW - pageLabelW - 16
      ),
      ml,
      FOOTER_RULE_Y - 12,
      { size: 8, color: [0.45, 0.45, 0.45] }
    )
  }

  return await pdf.save()
}

/* ------------------------------------------------------------------ */
/* Cache layer (DB)                                                   */
/* ------------------------------------------------------------------ */

/**
 * Load the canonical render input for a document. Same loader the PDF
 * cache uses — exported so the XRechnung XML generator can reuse the
 * exact same shape (doc + items + customer + vehicle + settings) without
 * duplicating any of the joins.
 */
export const loadDocumentRenderInput = async (
  documentId: string
): Promise<DocumentRenderInput | null> => {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)
  if (!doc) return null
  const items = await db
    .select()
    .from(documentItems)
    .where(eq(documentItems.documentId, documentId))
  let customer: Customer | null = null
  if (doc.customerId) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, doc.customerId))
      .limit(1)
    customer = c ?? null
  }
  let vehicle: (Vehicle & { licensePlate: string | null }) | null = null
  if (doc.vehicleId) {
    const [v] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, doc.vehicleId))
      .limit(1)
    if (v) {
      // Kennzeichen, das zum Belegdatum gültig war — vergangene
      // Rechnungen behalten dadurch das damals gefahrene Schild.
      const plateRow = await getEffectiveLicensePlate(v.id, doc.issueDate)
      vehicle = { ...v, licensePlate: plateRow?.licensePlate ?? null }
    }
  }
  const settings = await getSettings()
  return { doc, items, customer, vehicle, settings }
}

/**
 * Liest ausschliesslich den persistierten PDF-Cache eines Belegs;
 * KEIN Render-Fallback. Die View-Pfade nutzen diese Funktion und
 * werfen 404 wenn nichts da ist. Inhalte werden bewusst NICHT
 * automatisch neu gerendert, damit eine bereits versendete Rechnung
 * nicht im Nachhinein anders aussieht (rechtlicher Anspruch).
 */
export const loadCachedDocumentPdf = async (
  documentId: string
): Promise<DocumentPdf | null> => {
  const [row] = await db
    .select()
    .from(documentPdfs)
    .where(eq(documentPdfs.documentId, documentId))
    .limit(1)
  return row ?? null
}

/**
 * Erzeugt das PDF eines Belegs und persistiert es (überschreibt einen
 * eventuell vorhandenen alten Eintrag). Wird genau dann aufgerufen,
 * wenn der Beleg neu entsteht oder die Migration ihn anlegt — danach
 * gilt das gespeicherte PDF als final.
 */
export const renderAndPersistDocumentPdf = async (
  documentId: string
): Promise<DocumentPdf> => {
  const input = await loadDocumentRenderInput(documentId)
  if (!input) {
    throw new Error('Dokument nicht gefunden.')
  }
  const wantedHash = computeDocumentInputHash(input)
  const bytes = await renderDocumentPdf(input)
  const buffer = Buffer.from(bytes)
  const filename = `${input.doc.documentNumber}.pdf`
  await db.delete(documentPdfs).where(eq(documentPdfs.documentId, documentId))
  const [row] = await db
    .insert(documentPdfs)
    .values({
      documentId,
      inputHash: wantedHash,
      filename,
      mime: 'application/pdf',
      size: buffer.length,
      data: buffer
    })
    .returning()
  return row
}

/**
 * @deprecated View-Pfade nutzen ausschliesslich {@link
 * loadCachedDocumentPdf}; Schreib-Pfade {@link
 * renderAndPersistDocumentPdf}. Diese Wrapper-Funktion bleibt nur
 * vorhanden, weil ältere Aufrufer (Mail-Versand etc.) sie noch
 * referenzieren und in genau diesen Pfaden ein einmaliges
 * On-Demand-Rendern vertretbar ist.
 */
export const getOrRenderDocumentPdf = async (
  documentId: string
): Promise<DocumentPdf> => {
  const cached = await loadCachedDocumentPdf(documentId)
  if (cached) return cached
  return renderAndPersistDocumentPdf(documentId)
}

/**
 * Lightweight metadata-only lookup. Used by list / detail views that
 * want to know *whether* a PDF is already on disk without paying for
 * the bytes.
 */
export const getDocumentPdfMeta = async (
  documentId: string
): Promise<Omit<DocumentPdf, 'data'> | null> => {
  const [row] = await db
    .select({
      id: documentPdfs.id,
      documentId: documentPdfs.documentId,
      inputHash: documentPdfs.inputHash,
      filename: documentPdfs.filename,
      mime: documentPdfs.mime,
      size: documentPdfs.size,
      createdAt: documentPdfs.createdAt
    })
    .from(documentPdfs)
    .where(eq(documentPdfs.documentId, documentId))
    .limit(1)
  return row ?? null
}

/* ────────────────────────────────────────────────────────────────────── */
/* Reminders                                                              */
/* ────────────────────────────────────────────────────────────────────── */

const reminderTitleDe = (_level: number): string => 'Zahlungserinnerung'

/**
 * Standard friendly German body for every Zahlungserinnerung. There
 * is no escalation — the same conservative wording is used regardless
 * of how many reminders have already been sent for the invoice. The
 * `level` parameter is accepted for future template hooks but
 * deliberately not consumed.
 */
const reminderBodyDe = (_level: number, invoiceNumber: string): string =>
  [
    `wir möchten Sie freundlich daran erinnern, dass die Rechnung`,
    `${invoiceNumber} inzwischen fällig ist. Bitte begleichen Sie`,
    `den offenen Betrag bis zum unten genannten Datum. Sollten Sie`,
    `die Zahlung bereits angewiesen haben, betrachten Sie dieses`,
    `Schreiben bitte als gegenstandslos.`
  ].join(' ')

export type ReminderRenderInput = {
  reminder: Reminder
  invoice: Document
  customer: Customer | null
  vehicle: (Vehicle & { licensePlate: string | null }) | null
  settings: CompanySettings
}

export const computeReminderInputHash = (
  input: ReminderRenderInput
): string => {
  const canonical = sortObject({
    reminder: {
      id: input.reminder.id,
      number: input.reminder.documentNumber,
      level: input.reminder.level,
      issueDate: input.reminder.issueDate,
      dueDate: input.reminder.dueDate,
      notes: input.reminder.notes,
      updatedAt: input.reminder.updatedAt
    },
    invoice: {
      number: input.invoice.documentNumber,
      issueDate: input.invoice.issueDate,
      grossTotal: input.invoice.grossTotal,
      dueDate: input.invoice.dueDate
    },
    customer: input.customer
      ? {
          id: input.customer.id,
          customerNumber: input.customer.customerNumber,
          salutation: input.customer.salutation,
          company: input.customer.company,
          firstName: input.customer.firstName,
          lastName: input.customer.lastName,
          street: input.customer.street,
          zip: input.customer.zip,
          city: input.customer.city
        }
      : null,
    vehicle: input.vehicle
      ? {
          id: input.vehicle.id,
          make: input.vehicle.make,
          model: input.vehicle.model,
          licensePlate: input.vehicle.licensePlate,
          firstRegistration: input.vehicle.firstRegistration,
          mileageKm: input.vehicle.mileageKm,
          vin: input.vehicle.vin,
          nextHu: input.vehicle.nextHu,
          displacementCcm: input.vehicle.displacementCcm,
          powerKw: input.vehicle.powerKw,
          hsn: input.vehicle.hsn,
          tsn: input.vehicle.tsn
        }
      : null,
    settings: {
      name: input.settings.companyName,
      owner: input.settings.owner,
      street: input.settings.street,
      zip: input.settings.zip,
      city: input.settings.city,
      email: input.settings.email,
      phone: input.settings.phone,
      mobile: input.settings.mobile,
      fax: input.settings.fax,
      website: input.settings.website,
      taxNumber: input.settings.taxNumber,
      vatId: input.settings.vatId,
      bankName: input.settings.bankName,
      iban: input.settings.iban,
      bic: input.settings.bic,
      logoMime: input.settings.logoMime,
      logoHash: input.settings.logoData
        ? createHash('sha256').update(input.settings.logoData).digest('hex')
        : null,
      pdfFooter: input.settings.pdfFooter
    }
  })
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

/**
 * Render an A4 PDF for the given Zahlungserinnerung. Visually shares
 * the modern Twincars layout with {@link renderDocumentPdf}: same
 * logo + company header, return-to-sender mini line, customer block,
 * vehicle info, right-aligned title, and standardized closing — only
 * the body (friendly reminder text + Forderungsaufstellung) is
 * reminder-specific. No Mahngebühr, no Verzugszinsen.
 */
export const renderReminderPdf = async (
  input: ReminderRenderInput
): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create()
  pdf.setTitle(
    `${reminderTitleDe(input.reminder.level)} ${input.reminder.documentNumber}`
  )
  pdf.setProducer('TwinCarsManager')
  if (input.settings.companyName) pdf.setAuthor(input.settings.companyName)
  // Deterministic metadata — see renderDocumentPdf.
  const metaDate =
    input.reminder.updatedAt instanceof Date
      ? input.reminder.updatedAt
      : new Date(0)
  pdf.setCreationDate(metaDate)
  pdf.setModificationDate(metaDate)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const fontBoldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique)

  /* — Embed logo (PNG / JPEG) once if available. — */
  let logoImage:
    | Awaited<ReturnType<typeof pdf.embedPng>>
    | Awaited<ReturnType<typeof pdf.embedJpg>>
    | null = null
  if (input.settings.logoData && input.settings.logoMime) {
    try {
      const m = /^data:([^;]+);base64,(.+)$/.exec(input.settings.logoData)
      const mime = m ? m[1] : input.settings.logoMime
      const base64 = m ? m[2] : input.settings.logoData
      const bytes = Buffer.from(base64, 'base64')
      if (/png/i.test(mime)) logoImage = await pdf.embedPng(bytes)
      else if (/jpe?g/i.test(mime)) logoImage = await pdf.embedJpg(bytes)
    } catch {
      logoImage = null
    }
  }

  const PAGE_W = 595.28
  const PAGE_H = 841.89
  const ml = 50
  const mr = 50
  const innerW = PAGE_W - ml - mr
  const co = input.settings
  const cust = input.customer
  const veh = input.vehicle
  const r = input.reminder
  const inv = input.invoice
  const title = reminderTitleDe(r.level)

  const page = pdf.addPage([PAGE_W, PAGE_H])

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: {
      size?: number
      font?: typeof font
      color?: [number, number, number]
      width?: number
      align?: 'left' | 'right'
      lineHeight?: number
    } = {}
  ) => {
    const f = opts.font ?? font
    const size = opts.size ?? 10
    const safe = sanitizeWinAnsiText(s)
    let drawX = x
    if (opts.align === 'right') {
      const tw = f.widthOfTextAtSize(safe, size)
      drawX = x - tw
    }
    page.drawText(safe, {
      x: drawX,
      y: yy,
      size,
      font: f,
      color: rgb(...(opts.color ?? [0, 0, 0])),
      maxWidth: opts.width,
      lineHeight: opts.lineHeight
    })
  }

  /* ── Header: logo + company contact (right-aligned) ───────────── */
  const top = PAGE_H - 40

  if (logoImage) {
    const maxW = 210
    const maxH = 70
    const ratio = Math.min(maxW / logoImage.width, maxH / logoImage.height)
    page.drawImage(logoImage, {
      x: ml,
      y: top - logoImage.height * ratio,
      width: logoImage.width * ratio,
      height: logoImage.height * ratio
    })
  } else {
    text(co.companyName || 'Firma', ml, top - 14, { size: 14, font: fontBold })
  }

  let ry = top
  const rightX = PAGE_W - mr
  const RIGHT_BLOCK_MAX_W = 262
  const coNameSize = shrinkFontSize(
    co.companyName || 'Firma',
    fontBold,
    14,
    10,
    RIGHT_BLOCK_MAX_W
  )
  text(
    fitTextToWidth(
      co.companyName || 'Firma',
      fontBold,
      coNameSize,
      RIGHT_BLOCK_MAX_W
    ),
    rightX,
    ry,
    { size: coNameSize, font: fontBold, align: 'right' }
  )
  ry -= 16
  const rightLine = (line: string) => {
    text(fitTextToWidth(line, font, 9, RIGHT_BLOCK_MAX_W), rightX, ry, {
      size: 9,
      align: 'right'
    })
    ry -= 11
  }
  if (co.owner) rightLine(`KFZ Meisterbetrieb Inh. ${co.owner}`)
  rightLine(co.street)
  rightLine(`${co.zip} ${co.city}`.trim())
  if (co.phone) rightLine(`Tel: ${co.phone}`)
  if (co.mobile) rightLine(`Mobil: ${co.mobile}`)
  if (co.fax) rightLine(`Fax: ${co.fax}`)
  if (co.email) rightLine(`Email: ${co.email}`)
  if (co.website) rightLine(co.website.replace(/^https?:\/\//, ''))
  if (co.vatId) rightLine(`Ust.ID.Nr.: ${co.vatId}`)
  if (co.taxNumber) rightLine(`St.Nr.: ${co.taxNumber}`)
  if (co.bankName) rightLine(co.bankName)
  if (co.bic) rightLine(`BIC: ${co.bic}`)
  if (co.iban) rightLine(`IBAN: ${co.iban}`)

  /* ── Customer block (left) with return-to-sender ──────────────── */
  const ADDRESS_MAX_W = 250
  let cy = top - 90
  if (logoImage) cy = top - 110
  if (co.companyName || co.street || co.city) {
    const rts = fitTextToWidth(
      `${co.companyName} ° ${co.street} ° ${co.zip} ${co.city}`.trim(),
      font,
      7,
      ADDRESS_MAX_W
    )
    text(rts, ml, cy, { size: 7, color: [0.3, 0.3, 0.3] })
    const rtsW = font.widthOfTextAtSize(rts, 7)
    page.drawLine({
      start: { x: ml, y: cy - 1 },
      end: { x: ml + rtsW, y: cy - 1 },
      thickness: 0.3,
      color: rgb(0.4, 0.4, 0.4)
    })
    cy -= 12
  }
  const addressLine = (value: string) => {
    for (const line of wrapTextLines(value, font, 10, ADDRESS_MAX_W)) {
      text(line, ml, cy, { size: 10 })
      cy -= 12
    }
  }
  if (cust) {
    text(customerHeading(cust), ml, cy, { size: 10 })
    cy -= 12
    addressLine(customerName(cust))
    if (cust.street) addressLine(cust.street)
    if (cust.zip || cust.city) {
      addressLine(`${cust.zip ?? ''} ${cust.city ?? ''}`.trim())
    }
  } else {
    text('Kein Kunde hinterlegt', ml, cy, { size: 10, color: [0.6, 0.6, 0.6] })
    cy -= 12
  }

  /* ── Vehicle block (left, italic, two cols) ────────────────────── */
  let vy = Math.min(cy - 24, ry - 30)
  if (veh) {
    const colA = ml
    const colB = ml + 200
    const colAMaxW = colB - colA - 8
    // Cap column B short of the right-aligned title/meta block.
    const colBMaxW = 130
    const ti = (s2: string, x: number, yy: number, maxW: number) =>
      text(fitTextToWidth(s2, fontItalic, 9, maxW), x, yy, {
        size: 9,
        font: fontItalic
      })
    const kfzTyp = `${veh.make ?? ''} ${veh.model ?? ''}`.trim() || '-'
    ti(`Kfz-Typ: ${kfzTyp}`, colA, vy, colAMaxW)
    if (veh.displacementCcm)
      ti(`Hubraum: ${veh.displacementCcm}`, colB, vy, colBMaxW)
    vy -= 11
    if (veh.licensePlate)
      ti(`Kennzeichen: ${veh.licensePlate}`, colA, vy, colAMaxW)
    if (veh.powerKw) ti(`Kw: ${veh.powerKw}`, colB, vy, colBMaxW)
    vy -= 11
    if (veh.firstRegistration)
      ti(
        `Erstzulassung: ${monthYear(veh.firstRegistration)}`,
        colA,
        vy,
        colAMaxW
      )
    if (veh.hsn || veh.tsn)
      ti(`zu2: ${veh.hsn ?? ''} zu3: ${veh.tsn ?? ''}`, colB, vy, colBMaxW)
    vy -= 11
    if (veh.mileageKm != null)
      ti(`km-Stand: ${veh.mileageKm}`, colA, vy, colAMaxW)
    vy -= 11
    if (veh.vin) ti(`Kfz-Ident.Nr.: ${veh.vin}`, colA, vy, colAMaxW)
    vy -= 11
    if (veh.nextHu) ti(`HU: ${monthYearFull(veh.nextHu)}`, colA, vy, colAMaxW)
    vy -= 11
  }

  /* ── Title + meta (right) ──────────────────────────────────────── */
  let ty = ry - 30
  text(title, rightX, ty, { size: 22, font: fontBoldItalic, align: 'right' })
  ty -= 22
  text('Seite 1 von 1', rightX, ty, {
    size: 9,
    font: fontItalic,
    align: 'right'
  })
  ty -= 12
  text(`Datum: ${formatDate(r.issueDate)}`, rightX, ty, {
    size: 9,
    font: fontItalic,
    align: 'right'
  })
  ty -= 12
  text(`Erinnerungs-Nr.: ${r.documentNumber}`, rightX, ty, {
    size: 10,
    font: fontBold,
    align: 'right'
  })
  ty -= 12
  if (cust?.customerNumber) {
    text(`Kundennummer: ${cust.customerNumber}`, rightX, ty, {
      size: 9,
      font: fontItalic,
      align: 'right'
    })
    ty -= 12
  }
  text(`Zahlbar bis: ${formatDate(r.dueDate)}`, rightX, ty, {
    size: 9,
    font: fontItalic,
    align: 'right'
  })
  ty -= 12

  /* ── Salutation + dunning body ─────────────────────────────────── */
  let y = Math.min(vy, ty) - 14
  text('Sehr geehrte Damen und Herren,', ml, y, { size: 10 })
  y -= 18
  // Exact wrap (measured, not estimated) so the settlement table below
  // can never overlap the body paragraph.
  const body = reminderBodyDe(r.level, inv.documentNumber)
  for (const line of wrapTextLines(body, font, 10, innerW)) {
    text(line, ml, y, { size: 10 })
    y -= 14
  }
  y -= 4

  /* ── Forderungsaufstellung (settlement table) ──────────────────── */
  const labelRight = ml + innerW - 90
  const valueRight = ml + innerW - 5
  const settlementRow = (
    label: string,
    value: string,
    opts: { bold?: boolean; italic?: boolean; size?: number } = {}
  ) => {
    const f = opts.bold
      ? opts.italic
        ? fontBoldItalic
        : fontBold
      : opts.italic
        ? fontItalic
        : font
    const size = opts.size ?? 10
    text(label, labelRight, y, { size, font: f, align: 'right' })
    text(value, valueRight, y, { size, font: f, align: 'right' })
    y -= 14
  }

  page.drawLine({
    start: { x: ml, y: y + 4 },
    end: { x: PAGE_W - mr, y: y + 4 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  })
  y -= 4
  settlementRow(
    `Offene Rechnung ${inv.documentNumber}`,
    formatEur(inv.grossTotal),
    { italic: true, size: 9 }
  )
  page.drawLine({
    start: { x: ml, y: y + 4 },
    end: { x: PAGE_W - mr, y: y + 4 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  })
  y -= 6
  settlementRow('Offener Betrag:', formatEur(inv.grossTotal), {
    bold: true,
    italic: true,
    size: 11
  })
  // Double underline under the total value.
  page.drawLine({
    start: { x: valueRight - 70, y: y + 12 },
    end: { x: valueRight, y: y + 12 },
    thickness: 0.6,
    color: rgb(0, 0, 0)
  })
  page.drawLine({
    start: { x: valueRight - 70, y: y + 10 },
    end: { x: valueRight, y: y + 10 },
    thickness: 0.6,
    color: rgb(0, 0, 0)
  })
  y -= 14

  /* ── Optional company-wide PDF footer / Werbe-/Endtext ─────────── */
  if (co.pdfFooter && y > 110) {
    for (const line of wrapTextLines(co.pdfFooter, font, 10, innerW)) {
      text(line, ml, y, { size: 10 })
      y -= 12
    }
    y -= 6
  }

  /* ── Standard closing ──────────────────────────────────────────── */
  if (y > 90) {
    text('Mit freundlichen Grüßen', ml, y, { size: 10, font: fontItalic })
    y -= 14
    text(co.companyName || '', ml, y, { size: 10, font: fontBold })
  }

  return await pdf.save()
}

const loadReminderRenderInput = async (
  reminderId: string
): Promise<ReminderRenderInput | null> => {
  const [reminder] = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, reminderId))
    .limit(1)
  if (!reminder) return null
  const [invoice] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, reminder.invoiceId))
    .limit(1)
  if (!invoice) return null
  let customer: Customer | null = null
  if (invoice.customerId) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, invoice.customerId))
      .limit(1)
    customer = c ?? null
  }
  let vehicle: (Vehicle & { licensePlate: string | null }) | null = null
  if (invoice.vehicleId) {
    const [v] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, invoice.vehicleId))
      .limit(1)
    if (v) {
      const plateRow = await getEffectiveLicensePlate(v.id, reminder.issueDate)
      vehicle = { ...v, licensePlate: plateRow?.licensePlate ?? null }
    }
  }
  const settings = await getSettings()
  return { reminder, invoice, customer, vehicle, settings }
}

/**
 * Hash-cached reminder PDF. Same contract as
 * {@link getOrRenderDocumentPdf}: re-render whenever any input that
 * influences the rendered bytes changes.
 */
export const loadCachedReminderPdf = async (
  reminderId: string
): Promise<ReminderPdf | null> => {
  const [row] = await db
    .select()
    .from(reminderPdfs)
    .where(eq(reminderPdfs.reminderId, reminderId))
    .limit(1)
  return row ?? null
}

export const renderAndPersistReminderPdf = async (
  reminderId: string
): Promise<ReminderPdf> => {
  const input = await loadReminderRenderInput(reminderId)
  if (!input) throw new Error('Zahlungserinnerung nicht gefunden.')
  const wantedHash = computeReminderInputHash(input)
  const bytes = await renderReminderPdf(input)
  const buffer = Buffer.from(bytes)
  const filename = `${input.reminder.documentNumber}.pdf`
  await db.delete(reminderPdfs).where(eq(reminderPdfs.reminderId, reminderId))
  const [row] = await db
    .insert(reminderPdfs)
    .values({
      reminderId,
      inputHash: wantedHash,
      filename,
      mime: 'application/pdf',
      size: buffer.length,
      data: buffer
    })
    .returning()
  return row
}

/**
 * @deprecated View-Pfade nutzen {@link loadCachedReminderPdf}; nur
 * für Mail-Versand und Kompatibilität wird hier noch on-demand
 * gerendert.
 */
export const getOrRenderReminderPdf = async (
  reminderId: string
): Promise<ReminderPdf> => {
  const cached = await loadCachedReminderPdf(reminderId)
  if (cached) return cached
  return renderAndPersistReminderPdf(reminderId)
}

export const getReminderPdfMeta = async (
  reminderId: string
): Promise<Omit<ReminderPdf, 'data'> | null> => {
  const [row] = await db
    .select({
      id: reminderPdfs.id,
      reminderId: reminderPdfs.reminderId,
      inputHash: reminderPdfs.inputHash,
      filename: reminderPdfs.filename,
      mime: reminderPdfs.mime,
      size: reminderPdfs.size,
      createdAt: reminderPdfs.createdAt
    })
    .from(reminderPdfs)
    .where(eq(reminderPdfs.reminderId, reminderId))
    .limit(1)
  return row ?? null
}

/* ────────────────────────────────────────────────────────────────────── */
/* Phase 5: QR labels + A4-landscape car sale sign                        */
/* ────────────────────────────────────────────────────────────────────── */
/**
 * Render an A6-landscape QR-Etikett for a tire-storage entry. The QR
 * payload is `scanUrl` — a deep link of the form
 * `{origin}/tire-storage/scan/<storageNumber>` so a phone scan opens the
 * entry directly. Falls back to the bare storage number when no URL is
 * supplied (offline / legacy callers still get a readable code).
 */
export async function renderTireStorageLabelPdf(
  entry: import('$lib/server/db/schema').TireStorage & {
    customerName?: string
  },
  scanUrl?: string
): Promise<Buffer> {
  const qr = await renderQrPng(scanUrl ?? entry.storageNumber, { size: 320 })

  const doc = await PDFDocument.create()
  // Deterministic metadata — see renderDocumentPdf.
  const metaDate =
    entry.updatedAt instanceof Date ? entry.updatedAt : new Date(0)
  doc.setCreationDate(metaDate)
  doc.setModificationDate(metaDate)
  const page = doc.addPage([419.5, 297.6])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const qrImage = await doc.embedPng(qr)

  page.drawImage(qrImage, { x: 16, y: 40, width: 220, height: 220 })

  // Text column right of the QR: width-fitted (not char-count-trimmed)
  // so long values can never run off the label edge.
  const textX = 250
  const textMaxW = 419.5 - textX - 14
  let y = 260
  page.drawText(
    fitTextToWidth(
      entry.storageNumber,
      bold,
      shrinkFontSize(entry.storageNumber, bold, 20, 12, textMaxW),
      textMaxW
    ),
    {
      x: textX,
      y,
      size: shrinkFontSize(entry.storageNumber, bold, 20, 12, textMaxW),
      font: bold,
      color: rgb(0, 0, 0)
    }
  )
  if (entry.customerName) {
    y -= 30
    page.drawText(fitTextToWidth(entry.customerName, font, 12, textMaxW), {
      x: textX,
      y,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2)
    })
  }
  if (entry.brand || entry.size) {
    y -= 22
    page.drawText(
      fitTextToWidth(
        [entry.brand, entry.model, entry.size].filter(Boolean).join(' '),
        font,
        10,
        textMaxW
      ),
      { x: textX, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) }
    )
  }
  if (entry.season) {
    y -= 18
    page.drawText(fitTextToWidth(entry.season, font, 10, textMaxW), {
      x: textX,
      y,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3)
    })
  }

  return Buffer.from(await doc.save())
}

/**
 * Lazily loaded bytes of the bundled app icon
 * (`static/icons/icon-256.png`), used as the sale-sign logo fallback
 * when the company has not uploaded a logo. `undefined` = not yet
 * attempted, `null` = not found on disk (renders without a logo).
 */
let appIconPngCache: Buffer | null | undefined

async function loadAppIconPng(): Promise<Buffer | null> {
  if (appIconPngCache !== undefined) return appIconPngCache
  // Dev + vitest run from the repo root (static/…); the production
  // container runs `node build` from /app, where adapter-node copied
  // the static assets into build/client. Fail soft to "no logo".
  const candidates = [
    join(process.cwd(), 'static', 'icons', 'icon-256.png'),
    join(process.cwd(), 'build', 'client', 'icons', 'icon-256.png'),
    join(process.cwd(), 'client', 'icons', 'icon-256.png')
  ]
  for (const candidate of candidates) {
    try {
      appIconPngCache = await readFile(candidate)
      return appIconPngCache
    } catch {
      // Try the next location.
    }
  }
  appIconPngCache = null
  return null
}

/**
 * Embed the sale-sign header logo: the uploaded company logo when
 * present (PNG or JPEG, raw base64 or data URL — same wire formats the
 * invoice renderer accepts), otherwise the bundled app icon. Returns
 * `null` when neither source yields a usable image.
 */
async function embedSaleSignLogo(
  doc: PDFDocument,
  settings?: { logoData?: string | null; logoMime?: string | null }
): Promise<PDFImage | null> {
  if (settings?.logoData) {
    try {
      const m = /^data:([^;]+);base64,(.+)$/.exec(settings.logoData)
      const mime = m ? m[1] : (settings.logoMime ?? '')
      const base64 = m ? m[2] : settings.logoData
      const bytes = Buffer.from(base64, 'base64')
      return mime.includes('png')
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes)
    } catch {
      // Corrupt upload — fall through to the app icon.
    }
  }
  const iconBytes = await loadAppIconPng()
  if (!iconBytes) return null
  try {
    return await doc.embedPng(iconBytes)
  } catch {
    return null
  }
}

/**
 * Render an A4-landscape "ZUM VERKAUF"-Schild for a vehicle, intended
 * to be printed and placed under the windshield.
 *
 * Layout (top to bottom): a bold red header band with the "ZUM
 * VERKAUF" headline on the left and the company logo (uploaded logo or
 * the bundled app icon as fallback) + company name on the right; the
 * vehicle title with a short red accent bar; a photo panel on the left
 * and a red hero price box above the aligned label/value facts table on
 * the right; a footer strip with marketing highlights (red square
 * bullets, up to four in two columns), the contact line, and the QR
 * code with an "Online ansehen" caption in the bottom-right corner.
 *
 * The `vehicle` argument is enriched with the cover photo bytes, the
 * gross price (already snapshotted on the listing row), and a short
 * `highlights` array of marketing bullet points via `salesNotes`.
 */
export async function renderVehicleSaleSignPdf(input: {
  vehicle: import('$lib/server/db/schema').Vehicle
  coverPhoto?: { mime: string; data?: Buffer; dataUrl?: string } | null
  salesPriceGross?: number | null
  differentialTax?: boolean
  salesNotes?: string | null
  qrPayload?: string
  settings?: {
    companyName?: string | null
    phone?: string | null
    zip?: string | null
    city?: string | null
    logoData?: string | null
    logoMime?: string | null
  }
}): Promise<Buffer> {
  const vehicle = input.vehicle
  const photoMime = input.coverPhoto?.mime ?? null
  let photoBytes: Buffer | null = null
  if (input.coverPhoto?.data) {
    photoBytes = input.coverPhoto.data
  } else if (input.coverPhoto?.dataUrl) {
    const m = /^data:[^;]+;base64,(.+)$/.exec(input.coverPhoto.dataUrl)
    if (m) photoBytes = Buffer.from(m[1], 'base64')
  }
  const highlights = (input.salesNotes ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const companyName = input.settings?.companyName ?? undefined
  const companyPhone = input.settings?.phone ?? undefined
  const companyCity = [input.settings?.zip, input.settings?.city]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
  const listingUrl = input.qrPayload

  // ── Palette ──────────────────────────────────────────────────────
  const ink = rgb(0.12, 0.13, 0.16) // near-black slate (title / values)
  const muted = rgb(0.44, 0.46, 0.5) // labels
  const hair = rgb(0.85, 0.86, 0.88) // separators
  const panel = rgb(0.96, 0.965, 0.97) // light fills
  const red = rgb(0.76, 0.05, 0.1) // signal red (band, price, accents)
  const redDark = rgb(0.55, 0.03, 0.07) // band / price box bottom edge
  const redTint = rgb(1, 0.85, 0.85) // light-on-red secondary text
  const white = rgb(1, 1, 1)

  const title =
    truncate(`${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim(), 60) ||
    'Fahrzeug'

  const doc = await PDFDocument.create()
  doc.setTitle(`Verkaufsschild ${title}`)
  // Deterministic metadata — see renderDocumentPdf.
  const metaDate =
    vehicle.updatedAt instanceof Date ? vehicle.updatedAt : new Date(0)
  doc.setCreationDate(metaDate)
  doc.setModificationDate(metaDate)
  // A4 landscape: 297 × 210 mm → 841.89 × 595.28 pt
  const W = 841.89
  const H = 595.28
  const M = 36
  const page = doc.addPage([W, H])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const textRight = (
    text: string,
    xRight: number,
    y: number,
    size: number,
    f: typeof font,
    color: ReturnType<typeof rgb>
  ) => {
    const safe = sanitizeWinAnsiText(text)
    const w = f.widthOfTextAtSize(safe, size)
    page.drawText(safe, { x: xRight - w, y, size, font: f, color })
  }
  const textCentered = (
    text: string,
    xCenter: number,
    y: number,
    size: number,
    f: typeof font,
    color: ReturnType<typeof rgb>
  ) => {
    const safe = sanitizeWinAnsiText(text)
    const w = f.widthOfTextAtSize(safe, size)
    page.drawText(safe, { x: xCenter - w / 2, y, size, font: f, color })
  }
  /**
   * Ellipsis-fit into `maxW` points — WinAnsi-sanitizing, so measuring
   * user text (make/model, highlights, colors) can never throw.
   */
  const fit = (text: string, f: typeof font, size: number, maxW: number) =>
    fitTextToWidth(text, f, size, maxW)

  // ── Helpers: legacy-friendly value formatting ────────────────────
  const nf = new Intl.NumberFormat('de-DE')
  const monthYear = (iso: string | null | undefined): string | null => {
    const m = /^(\d{4})-(\d{2})/.exec((iso ?? '').trim())
    return m ? `${m[2]}/${m[1]}` : iso?.trim() || null
  }

  // ── Header band: headline left, logo + company right ─────────────
  const bandH = 96
  const bandY = H - bandH
  page.drawRectangle({ x: 0, y: bandY, width: W, height: bandH, color: red })
  page.drawRectangle({ x: 0, y: bandY, width: W, height: 4, color: redDark })
  const headline = 'ZUM VERKAUF'
  const headlineSize = 46
  page.drawText(headline, {
    x: M,
    y: bandY + 32,
    size: headlineSize,
    font: bold,
    color: white
  })

  // Logo chip: white card at the far right of the band. The uploaded
  // company logo wins; the bundled app icon is the fallback.
  const logo = await embedSaleSignLogo(doc, input.settings)
  let companyRight = W - M
  if (logo) {
    const maxLogoH = 48
    const maxLogoW = 116
    const s = Math.min(maxLogoW / logo.width, maxLogoH / logo.height)
    const lw = logo.width * s
    const lh = logo.height * s
    const chipPad = 9
    const chipW = Math.max(lw + chipPad * 2, 64)
    const chipH = 64
    const chipX = W - M - chipW
    const chipY = bandY + (bandH - chipH) / 2
    page.drawRectangle({
      x: chipX,
      y: chipY,
      width: chipW,
      height: chipH,
      color: white
    })
    page.drawImage(logo, {
      x: chipX + (chipW - lw) / 2,
      y: chipY + (chipH - lh) / 2,
      width: lw,
      height: lh
    })
    companyRight = chipX - 14
  }
  if (companyName) {
    const headlineEnd = M + bold.widthOfTextAtSize(headline, headlineSize) + 28
    const maxW = Math.max(60, companyRight - headlineEnd)
    const subline = [companyPhone, companyCity].filter(Boolean).join('  ·  ')
    const nameY = subline ? bandY + 52 : bandY + 42
    textRight(
      fit(companyName, bold, 15, maxW),
      companyRight,
      nameY,
      15,
      bold,
      white
    )
    if (subline) {
      textRight(
        fit(subline, font, 10, maxW),
        companyRight,
        bandY + 35,
        10,
        font,
        redTint
      )
    }
  }

  // ── Vehicle title with red accent bar ────────────────────────────
  const titleY = bandY - 44
  page.drawText(fit(title, bold, 30, W - 2 * M), {
    x: M,
    y: titleY,
    size: 30,
    font: bold,
    color: ink
  })
  page.drawRectangle({
    x: M,
    y: titleY - 14,
    width: 58,
    height: 4.5,
    color: red
  })

  // ── Photo panel (left) ───────────────────────────────────────────
  const photoX = M
  const photoW = 444
  const photoH = 276
  const photoY = 148
  page.drawRectangle({
    x: photoX,
    y: photoY,
    width: photoW,
    height: photoH,
    color: panel,
    borderColor: hair,
    borderWidth: 1
  })
  let drewPhoto = false
  if (photoBytes && photoMime) {
    try {
      const img = photoMime.includes('png')
        ? await doc.embedPng(photoBytes)
        : await doc.embedJpg(photoBytes)
      // Contain the image within the panel (preserve aspect ratio).
      const pad = 8
      const maxW = photoW - pad * 2
      const maxH = photoH - pad * 2
      const scale = Math.min(maxW / img.width, maxH / img.height)
      const w = img.width * scale
      const h = img.height * scale
      page.drawImage(img, {
        x: photoX + (photoW - w) / 2,
        y: photoY + (photoH - h) / 2,
        width: w,
        height: h
      })
      drewPhoto = true
    } catch {
      // Bad image bytes — fall through to placeholder.
    }
  }
  if (!drewPhoto) {
    // Ghost the logo behind the placeholder text so the empty panel
    // doesn't look broken when a car has no photo yet.
    if (logo) {
      const wmScale = Math.min(150 / logo.width, 150 / logo.height)
      const wmW = logo.width * wmScale
      const wmH = logo.height * wmScale
      page.drawImage(logo, {
        x: photoX + (photoW - wmW) / 2,
        y: photoY + (photoH - wmH) / 2 + 18,
        width: wmW,
        height: wmH,
        opacity: 0.08
      })
    }
    textCentered(
      'Foto folgt',
      photoX + photoW / 2,
      photoY + photoH / 2 - (logo ? 78 : 6),
      15,
      font,
      muted
    )
  }

  // ── Right column: hero price box + facts table ───────────────────
  const colX = 512
  const colR = W - M // right edge of the data column
  const colW = colR - colX

  const priceBoxY = 336
  const priceBoxH = 88
  if (input.salesPriceGross != null) {
    page.drawRectangle({
      x: colX,
      y: priceBoxY,
      width: colW,
      height: priceBoxH,
      color: red
    })
    page.drawRectangle({
      x: colX,
      y: priceBoxY,
      width: colW,
      height: 4,
      color: redDark
    })
    const priceStr = `${nf.format(input.salesPriceGross)} €`
    let priceSize = 42
    while (
      priceSize > 24 &&
      bold.widthOfTextAtSize(priceStr, priceSize) > colW - 32
    ) {
      priceSize -= 2
    }
    textCentered(
      priceStr,
      colX + colW / 2,
      priceBoxY + 38,
      priceSize,
      bold,
      white
    )
    textCentered(
      input.differentialTax
        ? 'Differenzbesteuert gem. §25a UStG'
        : 'inkl. gesetzl. MwSt.',
      colX + colW / 2,
      priceBoxY + 15,
      10,
      font,
      redTint
    )
  } else {
    page.drawRectangle({
      x: colX,
      y: priceBoxY,
      width: colW,
      height: priceBoxH,
      color: panel,
      borderColor: hair,
      borderWidth: 1
    })
    textCentered(
      'Preis auf Anfrage',
      colX + colW / 2,
      priceBoxY + 34,
      22,
      bold,
      red
    )
  }

  // Facts: labels left, values right-aligned — one shared column grid.
  const v = vehicle
  const psFromKw =
    v.powerKw != null ? ` (${Math.round(v.powerKw * 1.35962)} PS)` : ''
  const allFacts: Array<[string, string | null]> = [
    ['Erstzulassung', monthYear(v.firstRegistration)],
    [
      'Kilometerstand',
      v.mileageKm != null ? `${nf.format(v.mileageKm)} km` : null
    ],
    ['Kraftstoff', v.fuelType?.trim() || null],
    ['Getriebe', v.gearbox?.trim() || null],
    ['Leistung', v.powerKw != null ? `${v.powerKw} kW${psFromKw}` : null],
    [
      'Hubraum',
      v.displacementCcm != null ? `${nf.format(v.displacementCcm)} ccm` : null
    ],
    ['Karosserie', v.bodyType?.trim() || null],
    ['Farbe', v.colorCode?.trim() || null],
    ['HU bis', monthYear(v.nextHu)]
  ]
  const facts = allFacts.filter(([, value]) => value) as Array<[string, string]>
  const factsTop = priceBoxY - 30
  const factsBottom = 150
  const rowH =
    facts.length > 1
      ? Math.min(27, Math.floor((factsTop - factsBottom) / (facts.length - 1)))
      : 27
  const labelSize = rowH >= 24 ? 11 : 10
  const valueSize = rowH >= 24 ? 13 : 11.5
  facts.forEach(([label, value], i) => {
    const fy = factsTop - i * rowH
    page.drawText(label, {
      x: colX,
      y: fy,
      size: labelSize,
      font,
      color: muted
    })
    textRight(fit(value, bold, valueSize, 185), colR, fy, valueSize, bold, ink)
    if (i < facts.length - 1) {
      page.drawLine({
        start: { x: colX, y: fy - rowH * 0.32 },
        end: { x: colR, y: fy - rowH * 0.32 },
        thickness: 0.5,
        color: hair
      })
    }
  })

  // ── Footer strip: highlights, contact, QR ────────────────────────
  const footH = 128
  page.drawRectangle({ x: 0, y: footH - 3, width: W, height: 3, color: red })

  // QR (bottom-right corner) with caption below.
  let qrLeft = colR
  if (listingUrl) {
    const qrSize = 84
    const qr = await renderQrPng(listingUrl, { size: 220 })
    const qrImage = await doc.embedPng(qr)
    const qrX = W - M - qrSize
    page.drawImage(qrImage, { x: qrX, y: 32, width: qrSize, height: qrSize })
    textCentered('Online ansehen', qrX + qrSize / 2, 17, 10, bold, red)
    qrLeft = qrX - 24
  }

  // Highlights: red square bullets, up to four in two columns.
  if (highlights.length > 0) {
    const colGap = 320
    const rows = [footH - 29, footH - 51]
    highlights.slice(0, 4).forEach((h, i) => {
      const hx = M + Math.floor(i / 2) * colGap
      const hy = rows[i % 2]
      page.drawRectangle({
        x: hx,
        y: hy + 2.5,
        width: 5,
        height: 5,
        color: red
      })
      page.drawText(fit(h, font, 12, colGap - 32), {
        x: hx + 13,
        y: hy,
        size: 12,
        font,
        color: ink
      })
    })
  }

  // Contact line (bottom-left; vertically centered when no highlights).
  const contact = [companyName, companyPhone, companyCity]
    .filter(Boolean)
    .join('   ·   ')
  if (contact) {
    const contactY = highlights.length > 0 ? 24 : (footH - 12) / 2
    page.drawText(fit(contact, bold, 12, qrLeft - M - 10), {
      x: M,
      y: contactY,
      size: 12,
      font: bold,
      color: ink
    })
  }

  return Buffer.from(await doc.save())
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
