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
import {
  PDFDocument,
  PageSizes,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage
} from 'pdf-lib'
import { and, eq } from 'drizzle-orm'
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
  }).format(n)
}

const formatDate = (s: string | null | undefined): string => {
  if (!s) return '—'
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

/**
 * Estimate how many lines a string wraps to inside `maxW` at `size` pt
 * for the given font. We use this to reserve vertical space when laying
 * out items / paragraphs — pdf-lib's own wrap is hard to measure
 * post-draw, so a generous estimate is the simplest correct option.
 */
const wrapLineCount = (
  s: string,
  size: number,
  maxW: number,
  measureFont: PDFFont
): number => {
  if (!s) return 1
  const words = s.split(/\s+/)
  let line = ''
  let lines = 1
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (measureFont.widthOfTextAtSize(next, size) > maxW) {
      lines += 1
      line = w
    } else {
      line = next
    }
  }
  return lines
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
  return `${cust.firstName ?? ''} ${cust.lastName ?? ''}`.trim() || '—'
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
 * Multi-page support: items overflow onto a second page that repeats a
 * slim header (company name, doc title, page number, items table head).
 * Totals always land on the last page, never split.
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
  pdf.setCreationDate(new Date())
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
      let drawX = x
      if (opts.align === 'right') {
        const tw = f.widthOfTextAtSize(s, size)
        drawX = x - tw
      }
      page.drawText(s, {
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
      f.widthOfTextAtSize(s, size)
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
      // Text fallback: company name big.
      s.text(co.companyName || 'Firma', ml, top - 14, {
        size: 14,
        font: fontBold
      })
    }

    /* Right column: company contact block, fully right-aligned. */
    let ry = top
    const rightX = PAGE_W - mr
    s.text(co.companyName || 'Firma', rightX, ry, {
      size: 14,
      font: fontBold,
      align: 'right'
    })
    ry -= 16
    if (co.owner) {
      s.text(`KFZ Meisterbetrieb Inh. ${co.owner}`, rightX, ry, {
        size: 9,
        align: 'right'
      })
      ry -= 11
    }
    s.text(co.street, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
    s.text(`${co.zip} ${co.city}`.trim(), rightX, ry, {
      size: 9,
      align: 'right'
    })
    ry -= 11
    if (co.phone) {
      s.text(`Tel: ${co.phone}`, rightX, ry, { size: 9, align: 'right' })
      ry -= 11
    }
    if (co.mobile) {
      s.text(`Mobil: ${co.mobile}`, rightX, ry, { size: 9, align: 'right' })
      ry -= 11
    }
    if (co.fax) {
      s.text(`Fax: ${co.fax}`, rightX, ry, { size: 9, align: 'right' })
      ry -= 11
    }
    if (co.email) {
      s.text(`Email: ${co.email}`, rightX, ry, { size: 9, align: 'right' })
      ry -= 11
    }
    if (co.website) {
      s.text(co.website.replace(/^https?:\/\//, ''), rightX, ry, {
        size: 9,
        align: 'right'
      })
      ry -= 11
    }
    if (co.vatId) {
      s.text(`Ust.ID.Nr.: ${co.vatId}`, rightX, ry, { size: 9, align: 'right' })
      ry -= 11
    }
    if (co.taxNumber) {
      s.text(`St.Nr.: ${co.taxNumber}`, rightX, ry, { size: 9, align: 'right' })
      ry -= 11
    }
    if (co.bankName) {
      s.text(co.bankName, rightX, ry, { size: 9, align: 'right' })
      ry -= 11
    }
    if (co.bic) {
      s.text(`BIC: ${co.bic}`, rightX, ry, { size: 9, align: 'right' })
      ry -= 11
    }
    if (co.iban) {
      s.text(`IBAN: ${co.iban}`, rightX, ry, { size: 9, align: 'right' })
      ry -= 11
    }

    /* Customer block (left, below the logo). */
    let cy = top - 90
    if (logoImage) cy = top - 110
    // Return-to-sender mini line, slightly underlined.
    if (cust && (co.companyName || co.street || co.city)) {
      const rts =
        `${co.companyName} ° ${co.street} ° ${co.zip} ${co.city}`.trim()
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
    if (cust) {
      s.text(customerHeading(cust), ml, cy, { size: 10 })
      cy -= 12
      s.text(customerName(cust), ml, cy, { size: 10 })
      cy -= 12
      if (cust.street) {
        s.text(cust.street, ml, cy, { size: 10 })
        cy -= 12
      }
      if (cust.zip || cust.city) {
        s.text(`${cust.zip ?? ''} ${cust.city ?? ''}`.trim(), ml, cy, {
          size: 10
        })
        cy -= 12
      }
    } else {
      s.text('Kein Kunde hinterlegt', ml, cy, {
        size: 10,
        color: [0.6, 0.6, 0.6]
      })
      cy -= 12
    }

    /* Vehicle block (left, italic, two columns). */
    let vy = Math.min(cy - 24, ry - 30)
    if (veh) {
      const colA = ml
      const colB = ml + 200
      const txt = (s2: string, x: number, yy: number) =>
        s.text(s2, x, yy, { size: 9, font: fontItalic })
      const kfzTyp = `${veh.make ?? ''} ${veh.model ?? ''}`.trim() || '—'
      txt(`Kfz-Typ: ${kfzTyp}`, colA, vy)
      if (veh.displacementCcm) txt(`Hubraum: ${veh.displacementCcm}`, colB, vy)
      vy -= 11
      if (veh.licensePlate) txt(`Kennzeichen: ${veh.licensePlate}`, colA, vy)
      if (veh.powerKw) txt(`Kw: ${veh.powerKw}`, colB, vy)
      vy -= 11
      if (veh.firstRegistration)
        txt(`Erstzulassung: ${monthYear(veh.firstRegistration)}`, colA, vy)
      if (veh.hsn || veh.tsn)
        txt(`zu2: ${veh.hsn ?? ''} zu3: ${veh.tsn ?? ''}`, colB, vy)
      vy -= 11
      if (veh.mileageKm != null) txt(`km-Stand: ${veh.mileageKm}`, colA, vy)
      if (input.doc.serviceDate)
        txt(`Leistungsdatum: ${formatDate(input.doc.serviceDate)}`, colB, vy)
      vy -= 11
      if (veh.vin) txt(`Kfz-Ident.Nr.: ${veh.vin}`, colA, vy)
      vy -= 11
      if (veh.nextHu) txt(`HU: ${monthYearFull(veh.nextHu)}`, colA, vy)
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
      const reference = match ? match[1] : null
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
      s.text(input.doc.paymentMethod, rightX, ty, {
        size: 9,
        font: fontItalic,
        align: 'right'
      })
      ty -= 12
    }

    /* Intro line. */
    let y = Math.min(vy, ty) - 14
    s.text(documentIntroLine(docType), ml, y, { size: 10 })
    y -= 8
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

  const pages: PDFPage[] = []
  const pageItemRanges: Array<{ start: number; end: number }> = []

  const FIRST_PAGE_BODY_BOTTOM = 200 // reserve space for totals + closing
  const FOLLOW_PAGE_BODY_BOTTOM = 90 // smaller reserve when totals continue

  // First page: render header and start placing items.
  let page = pdf.addPage([PAGE_W, PAGE_H])
  pages.push(page)
  let y = drawFirstPageHeader(page)
  y -= 6
  y = drawItemsTableHeader(page, y)

  let itemIdx = 0
  let pageStart = 0

  while (itemIdx < input.items.length) {
    const it = input.items[itemIdx]
    const lines = wrapLineCount(it.description, 9, descMaxW, font)
    const itemHeight = Math.max(lineHeight, lines * lineHeight)

    const isLastItem = itemIdx === input.items.length - 1
    const reservedBottom = isLastItem
      ? FIRST_PAGE_BODY_BOTTOM
      : FOLLOW_PAGE_BODY_BOTTOM
    if (y - itemHeight < reservedBottom) {
      // Close current page's range and start a new one.
      pageItemRanges.push({ start: pageStart, end: itemIdx })
      page = pdf.addPage([PAGE_W, PAGE_H])
      pages.push(page)
      y = drawContinuationHeader(page)
      y = drawItemsTableHeader(page, y)
      pageStart = itemIdx
      continue
    }

    // Draw item on current page.
    const s = surface(page)
    const letter = itemKindLetter(it.kind)
    if (letter)
      s.text(letter, cols.kindX, y, { size: 8, color: [0.3, 0.3, 0.3] })
    if (it.articleNumber) s.text(it.articleNumber, cols.artX, y, { size: 9 })
    s.text(`${Number(it.quantity)}`, cols.qtyX, y, { size: 9 })
    s.text(it.unit ?? '', cols.unitX, y, { size: 9 })
    s.text(it.description, cols.descX, y, {
      size: 9,
      width: descMaxW,
      lineHeight
    })
    s.text(formatEur(it.unitPriceNet), cols.priceRight, y, {
      size: 9,
      align: 'right'
    })
    s.text(formatEur(it.lineTotalGross), cols.totalRight, y, {
      size: 9,
      align: 'right'
    })

    y -= itemHeight
    itemIdx += 1
  }
  pageItemRanges.push({ start: pageStart, end: itemIdx })

  /* — Totals box + closing on last page. — */
  const lastPage = pages[pages.length - 1]
  const ls = surface(lastPage)
  ls.hr(y)
  y -= 14

  /* Item-kind summary row (Leistung / Material / Artikel). */
  const sumByKind = (k: string) =>
    input.items
      .filter((i) => i.kind === k)
      .reduce((acc, i) => acc + Number(i.lineTotalNet), 0)
  const leistung = sumByKind('service')
  const material = sumByKind('material')
  const artikel = sumByKind('article')
  const passThrough = sumByKind('pass_through')
  if (leistung || material || artikel) {
    const split = `Leistung: ${formatEur(leistung)}    Material: ${formatEur(material)}    Artikel: ${formatEur(artikel)}`
    ls.text(split, ml, y, { size: 9 })
  }
  /* Totals — right-aligned, label / value with `right` alignment on a
     consistent x-rail. */
  const labelRight = ml + innerW - 90
  const valueRight = cols.totalRight
  const totalRow = (
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
    ls.text(label, labelRight, y, { size, font: f, align: 'right' })
    ls.text(value, valueRight, y, { size, font: f, align: 'right' })
    y -= 14
  }

  if (input.settings.smallBusinessExempt) {
    y -= 4
    totalRow('Gesamtbetrag:', formatEur(input.doc.grossTotal), { bold: true })
    // Double underline under Gesamtbetrag value.
    lastPage.drawLine({
      start: { x: valueRight - 70, y: y + 11 },
      end: { x: valueRight, y: y + 11 },
      thickness: 0.6,
      color: rgb(0, 0, 0)
    })
    lastPage.drawLine({
      start: { x: valueRight - 70, y: y + 9 },
      end: { x: valueRight, y: y + 9 },
      thickness: 0.6,
      color: rgb(0, 0, 0)
    })
    y -= 6
    ls.text('Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.', ml, y, {
      size: 9,
      font: fontItalic,
      color: [0.4, 0.4, 0.4],
      width: innerW
    })
    y -= 18
  } else {
    totalRow(
      'Summe MwStpflichtiger Positionen:',
      formatEur(input.doc.netTotal),
      { italic: true, size: 9 }
    )
    totalRow(
      `zzgl. AT Steuer: ${formatEur(0)}      zzgl. MwSt. ${Number(input.doc.taxRate)} %`,
      formatEur(input.doc.taxTotal),
      { italic: true, size: 9 }
    )
    totalRow('Zwischensumme:', formatEur(input.doc.grossTotal), {
      italic: true,
      size: 9
    })
    totalRow('Summe durchlaufender Posten:', formatEur(passThrough), {
      italic: true,
      size: 9
    })
    y -= 4
    totalRow('Gesamtbetrag:', formatEur(input.doc.grossTotal), {
      bold: true,
      italic: true,
      size: 11
    })
    // Double underline.
    lastPage.drawLine({
      start: { x: valueRight - 70, y: y + 12 },
      end: { x: valueRight, y: y + 12 },
      thickness: 0.6,
      color: rgb(0, 0, 0)
    })
    lastPage.drawLine({
      start: { x: valueRight - 70, y: y + 10 },
      end: { x: valueRight, y: y + 10 },
      thickness: 0.6,
      color: rgb(0, 0, 0)
    })
    y -= 6
  }

  /* "Zahlbar bis …" for invoices. */
  if (docType === 'invoice' && input.doc.dueDate) {
    ls.text(
      `Zahlbar bis zum ${formatDate(input.doc.dueDate)} ohne Abzug`,
      ml,
      y,
      { size: 10 }
    )
    y -= 18
  }

  /* User-supplied footer text (Werbe-/Endtext). */
  const customFooter = input.doc.footer || co.pdfFooter
  if (customFooter) {
    ls.text(customFooter, ml, y, { size: 10, width: innerW, lineHeight: 12 })
    const lines = wrapLineCount(customFooter, 10, innerW, font)
    y -= lines * 12 + 6
  }

  /* Standard German closing. */
  if (y > 90) {
    ls.text(documentClosingLine(docType), ml, y, {
      size: 10,
      font: fontItalic,
      width: innerW
    })
    y -= 14
    ls.text(
      'Der Gesetzgeber schreibt vor, für private Personen die Rechnung 2 Jahre aufzubewahren!',
      ml,
      y,
      { size: 10, font: fontItalic, width: innerW }
    )
  }

  /* — Now that we know the final page count, draw the "Seite X von N"
       lines using the y-positions stashed during header rendering. — */
  const totalPages = pages.length
  for (let i = 0; i < pages.length; i++) {
    const ps = surface(pages[i])
    ps.text(`Seite ${i + 1} von ${totalPages}`, PAGE_W - mr, pageNoLineYs[i], {
      size: 9,
      font: fontItalic,
      align: 'right'
    })
  }
  // pageItemRanges is intentionally tracked but unused for now —
  // it's the hook we'd need if we wanted per-page Zwischensummen.
  void pageItemRanges

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
  pdf.setCreationDate(new Date())
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
    let drawX = x
    if (opts.align === 'right') {
      const tw = f.widthOfTextAtSize(s, size)
      drawX = x - tw
    }
    page.drawText(s, {
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
  text(co.companyName || 'Firma', rightX, ry, {
    size: 14,
    font: fontBold,
    align: 'right'
  })
  ry -= 16
  if (co.owner) {
    text(`KFZ Meisterbetrieb Inh. ${co.owner}`, rightX, ry, {
      size: 9,
      align: 'right'
    })
    ry -= 11
  }
  text(co.street, rightX, ry, { size: 9, align: 'right' })
  ry -= 11
  text(`${co.zip} ${co.city}`.trim(), rightX, ry, { size: 9, align: 'right' })
  ry -= 11
  if (co.phone) {
    text(`Tel: ${co.phone}`, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
  }
  if (co.mobile) {
    text(`Mobil: ${co.mobile}`, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
  }
  if (co.fax) {
    text(`Fax: ${co.fax}`, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
  }
  if (co.email) {
    text(`Email: ${co.email}`, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
  }
  if (co.website) {
    text(co.website.replace(/^https?:\/\//, ''), rightX, ry, {
      size: 9,
      align: 'right'
    })
    ry -= 11
  }
  if (co.vatId) {
    text(`Ust.ID.Nr.: ${co.vatId}`, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
  }
  if (co.taxNumber) {
    text(`St.Nr.: ${co.taxNumber}`, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
  }
  if (co.bankName) {
    text(co.bankName, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
  }
  if (co.bic) {
    text(`BIC: ${co.bic}`, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
  }
  if (co.iban) {
    text(`IBAN: ${co.iban}`, rightX, ry, { size: 9, align: 'right' })
    ry -= 11
  }

  /* ── Customer block (left) with return-to-sender ──────────────── */
  let cy = top - 90
  if (logoImage) cy = top - 110
  if (co.companyName || co.street || co.city) {
    const rts = `${co.companyName} ° ${co.street} ° ${co.zip} ${co.city}`.trim()
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
  if (cust) {
    text(customerHeading(cust), ml, cy, { size: 10 })
    cy -= 12
    text(customerName(cust), ml, cy, { size: 10 })
    cy -= 12
    if (cust.street) {
      text(cust.street, ml, cy, { size: 10 })
      cy -= 12
    }
    if (cust.zip || cust.city) {
      text(`${cust.zip ?? ''} ${cust.city ?? ''}`.trim(), ml, cy, { size: 10 })
      cy -= 12
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
    const ti = (s2: string, x: number, yy: number) =>
      text(s2, x, yy, { size: 9, font: fontItalic })
    const kfzTyp = `${veh.make ?? ''} ${veh.model ?? ''}`.trim() || '—'
    ti(`Kfz-Typ: ${kfzTyp}`, colA, vy)
    if (veh.displacementCcm) ti(`Hubraum: ${veh.displacementCcm}`, colB, vy)
    vy -= 11
    if (veh.licensePlate) ti(`Kennzeichen: ${veh.licensePlate}`, colA, vy)
    if (veh.powerKw) ti(`Kw: ${veh.powerKw}`, colB, vy)
    vy -= 11
    if (veh.firstRegistration)
      ti(`Erstzulassung: ${monthYear(veh.firstRegistration)}`, colA, vy)
    if (veh.hsn || veh.tsn)
      ti(`zu2: ${veh.hsn ?? ''} zu3: ${veh.tsn ?? ''}`, colB, vy)
    vy -= 11
    if (veh.mileageKm != null) ti(`km-Stand: ${veh.mileageKm}`, colA, vy)
    vy -= 11
    if (veh.vin) ti(`Kfz-Ident.Nr.: ${veh.vin}`, colA, vy)
    vy -= 11
    if (veh.nextHu) ti(`HU: ${monthYearFull(veh.nextHu)}`, colA, vy)
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
  const body = reminderBodyDe(r.level, inv.documentNumber)
  text(body, ml, y, { size: 10, width: innerW, lineHeight: 14 })
  const approxLines = Math.max(1, Math.ceil(body.length / 70))
  y -= approxLines * 14 + 18

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
    text(co.pdfFooter, ml, y, { size: 10, width: innerW, lineHeight: 12 })
    const lines = wrapLineCount(co.pdfFooter, 10, innerW, font)
    y -= lines * 12 + 6
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
 * Render a small A6-landscape QR-Etikett for an article. The QR
 * payload is `{origin}/items/<articleNumber>`; consumers pass an
 * optional `origin` (request origin) so the same code works in dev /
 * staging / prod without a hard-coded base URL.
 *
 * Layout: a 90 mm × 60 mm card (close to A6 landscape) with the QR
 * on the left, article number + truncated description + current
 * price on the right.
 */
export async function renderArticleLabelPdf(
  item: {
    articleNumber: string
    description: string
    unitPriceNet?: string | null
    kind?: string | null
  },
  qrPayload: string
): Promise<Buffer> {
  const qr = await renderQrPng(qrPayload, { size: 320 })

  const doc = await PDFDocument.create()
  // A6 landscape: 148 × 105 mm → 419.5 × 297.6 pt
  const page = doc.addPage([419.5, 297.6])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const qrImage = await doc.embedPng(qr)

  page.drawImage(qrImage, { x: 16, y: 40, width: 220, height: 220 })

  let y = 260
  page.drawText(item.articleNumber, {
    x: 250,
    y,
    size: 18,
    font: bold,
    color: rgb(0, 0, 0)
  })
  y -= 26
  page.drawText(truncate(item.description, 60), {
    x: 250,
    y,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
    maxWidth: 150
  })
  if (item.unitPriceNet) {
    y -= 70
    page.drawText(`${item.unitPriceNet} €`, {
      x: 250,
      y,
      size: 22,
      font: bold,
      color: rgb(0, 0, 0)
    })
  }

  return Buffer.from(await doc.save())
}

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
  const page = doc.addPage([419.5, 297.6])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const qrImage = await doc.embedPng(qr)

  page.drawImage(qrImage, { x: 16, y: 40, width: 220, height: 220 })

  let y = 260
  page.drawText(entry.storageNumber, {
    x: 250,
    y,
    size: 20,
    font: bold,
    color: rgb(0, 0, 0)
  })
  if (entry.customerName) {
    y -= 30
    page.drawText(truncate(entry.customerName, 30), {
      x: 250,
      y,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2)
    })
  }
  if (entry.brand || entry.size) {
    y -= 22
    page.drawText(
      truncate(
        [entry.brand, entry.model, entry.size].filter(Boolean).join(' '),
        30
      ),
      { x: 250, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) }
    )
  }
  if (entry.season) {
    y -= 18
    page.drawText(entry.season, {
      x: 250,
      y,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3)
    })
  }

  return Buffer.from(await doc.save())
}

/**
 * Render an A4-landscape "ZUM VERKAUF"-Schild for a vehicle, intended
 * to be printed and placed under the windshield. Layout: large
 * headline + price at the top; key facts in a two-column grid below;
 * QR code at the bottom-right linking to the inventory listing.
 *
 * The `vehicle` argument is enriched with the cover photo bytes, the
 * gross price (already snapshotted on the listing row), the current
 * plate, and a short `highlights` array of marketing bullet points.
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
  const ink = rgb(0.11, 0.13, 0.18) // near-black slate (header / values)
  const muted = rgb(0.45, 0.47, 0.51) // labels
  const hair = rgb(0.85, 0.86, 0.88) // separators
  const panel = rgb(0.96, 0.965, 0.97) // light fills
  const accent = rgb(0.74, 0.11, 0.14) // price red
  const white = rgb(1, 1, 1)

  const doc = await PDFDocument.create()
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
    const w = f.widthOfTextAtSize(text, size)
    page.drawText(text, { x: xRight - w, y, size, font: f, color })
  }

  // ── Helpers: legacy-friendly value formatting ────────────────────
  const nf = new Intl.NumberFormat('de-DE')
  const monthYear = (iso: string | null | undefined): string | null => {
    const m = /^(\d{4})-(\d{2})/.exec((iso ?? '').trim())
    return m ? `${m[2]}/${m[1]}` : iso?.trim() || null
  }

  // ── Header band ──────────────────────────────────────────────────
  const bandH = 76
  page.drawRectangle({
    x: 0,
    y: H - bandH,
    width: W,
    height: bandH,
    color: ink
  })
  page.drawText('ZUM VERKAUF', {
    x: M,
    y: H - 50,
    size: 34,
    font: bold,
    color: white
  })
  if (companyName) {
    textRight(companyName, W - M, H - 34, 14, bold, white)
    if (companyCity) {
      textRight(companyCity, W - M, H - 52, 10, font, rgb(0.78, 0.8, 0.84))
    }
  }

  // ── Vehicle title (make + model) ─────────────────────────────────
  const titleY = H - bandH - 34
  page.drawText(
    truncate(`${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim(), 46),
    { x: M, y: titleY, size: 26, font: bold, color: ink }
  )

  // ── Photo panel (left) ───────────────────────────────────────────
  const photoX = M
  const photoW = 430
  const photoH = 300
  const photoY = 150
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
      const pad = 6
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
    const ph = 'Foto folgt'
    const phW = font.widthOfTextAtSize(ph, 16)
    page.drawText(ph, {
      x: photoX + (photoW - phW) / 2,
      y: photoY + photoH / 2 - 8,
      size: 16,
      font,
      color: muted
    })
  }

  // ── Right column: price + facts ──────────────────────────────────
  const colX = 500
  const colR = W - M // right edge of the data column

  // Price panel
  const priceY = 412
  const priceH = 78
  page.drawRectangle({
    x: colX,
    y: priceY,
    width: colR - colX,
    height: priceH,
    color: input.salesPriceGross != null ? accent : panel
  })
  if (input.salesPriceGross != null) {
    const priceStr = `${nf.format(input.salesPriceGross)} €`
    page.drawText(priceStr, {
      x: colX + 18,
      y: priceY + 30,
      size: 38,
      font: bold,
      color: white
    })
    page.drawText(
      input.differentialTax
        ? 'Differenzbesteuert gem. §25a UStG'
        : 'inkl. gesetzl. MwSt.',
      {
        x: colX + 18,
        y: priceY + 12,
        size: 10,
        font,
        color: rgb(1, 0.85, 0.85)
      }
    )
  } else {
    page.drawText('Preis auf Anfrage', {
      x: colX + 18,
      y: priceY + 30,
      size: 26,
      font: bold,
      color: ink
    })
  }

  // Facts table
  const v = vehicle
  const psFromKw =
    v.powerKw != null ? ` (${Math.round(v.powerKw * 1.35962)} PS)` : ''
  const facts: Array<[string, string | null]> = [
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
  let fy = priceY - 26
  const rowH = 27
  for (const [label, value] of facts) {
    if (!value) continue
    if (fy < 150) break
    page.drawText(label, { x: colX, y: fy, size: 11, font, color: muted })
    textRight(truncate(value, 34), colR, fy, 13, bold, ink)
    page.drawLine({
      start: { x: colX, y: fy - 8 },
      end: { x: colR, y: fy - 8 },
      thickness: 0.5,
      color: hair
    })
    fy -= rowH
  }

  // ── Footer band ──────────────────────────────────────────────────
  const footH = 118
  page.drawLine({
    start: { x: 0, y: footH },
    end: { x: W, y: footH },
    thickness: 1,
    color: hair
  })

  // Highlights (left, bullet list)
  if (highlights.length > 0) {
    let hy = footH - 28
    for (const h of highlights.slice(0, 3)) {
      page.drawText(`•  ${truncate(h, 52)}`, {
        x: M,
        y: hy,
        size: 12,
        font,
        color: ink
      })
      hy -= 20
    }
  }

  // Contact line (bottom-left)
  const contact = [companyName, companyPhone, companyCity]
    .filter(Boolean)
    .join('     ·     ')
  if (contact) {
    page.drawText(contact, { x: M, y: 16, size: 12, font: bold, color: ink })
  }

  // QR (bottom-right) with label to its LEFT (so nothing overlaps the code)
  if (listingUrl) {
    const qrSize = 88
    const qr = await renderQrPng(listingUrl, { size: 220 })
    const qrImage = await doc.embedPng(qr)
    const qrX = colR - qrSize
    const qrY = (footH - qrSize) / 2
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })
    textRight('Alle Infos online', qrX - 12, footH / 2 + 4, 11, bold, ink)
    textRight('Jetzt scannen', qrX - 12, footH / 2 - 12, 9, font, muted)
  }

  return Buffer.from(await doc.save())
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
