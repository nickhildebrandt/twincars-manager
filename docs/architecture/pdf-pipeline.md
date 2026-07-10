---
title: PDF pipeline
tags: [architecture, pdf, pdf-lib, visual-regression]
updated: 2026-07-10
---

# PDF pipeline

Generation and caching live in
`src/lib/server/services/pdf-service.ts` (built on **pdf-lib**); viewing
uses the browser's native PDF viewer via a Blob-URL iframe in
`PdfViewer.svelte`. All PDF remotes are in the
single global `src/routes/pdfs.remote.ts` (not per-module):
`getDocumentPdfMetaRemote`, `getDocumentPdfBytesRemote`,
`getReminderPdfMetaRemote`, `getReminderPdfBytesRemote`. List views may
only call the meta queries - bytes never travel through metadata calls.

## Cache model ([[adr-006-pdfs-in-postgres]])

Rendered bytes live in `document_pdfs` / `reminder_pdfs` (`bytea`) keyed
by a canonical `inputHash` over everything that influences the render
(`computeDocumentInputHash` / `computeReminderInputHash`). Read path:
`getOrRenderDocumentPdf` - if the stored hash matches the current input
the cached PDF is served, otherwise it re-renders and persists
(`renderAndPersistDocumentPdf`). Two parallel cache tables because
reminders are not `documents` rows.

## Renderers in pdf-service.ts

- `renderDocumentPdf` - Rechnung / Angebot / KV / AB, incl. §19 UStG
  notice when `smallBusinessExempt`, logo, footer, payment info.
- `renderReminderPdf` - Zahlungserinnerung.
- `renderTireStorageLabelPdf` - A6 QR label for a Reifeneinlagerung
  (Nummer / Kunde / Reifensatz / QR); QR payload
  `{origin}/tire-storage/scan/<storageNumber>` so a phone scan resolves
  to the detail page. Exposed via
  `src/routes/tire-storage/labels.remote.ts`. (This is the ONLY QR
  label left: the A6 article label and its `renderArticleLabelPdf` /
  `items/labels.remote.ts` were removed 2026-07 per requirement,
  [[items]].)
- `renderVehicleSaleSignPdf` - A4 landscape "Verkaufsschild", redesigned
  2026-07: bold red header band ("ZUM VERKAUF" left, logo chip right - a
  white card holding the uploaded company logo or the bundled app icon
  `static/icons/icon-256.png` as fallback), vehicle title with a red
  accent bar, photo panel left, red hero price box (honoring
  `differentialTax` / "Preis auf Anfrage") above the aligned label/value
  facts grid right (real vehicle columns
  fuelType/gearbox/colorCode/displacementCcm/powerKw/bodyType), footer
  with marketing highlights (red square bullets, up to four in two
  columns), contact line and QR code captioned "Online ansehen"
  bottom-right. Exposed via `src/routes/vehicles/sale-sign.remote.ts`.

QR codes come from `src/lib/server/services/qr-service.ts`
(`renderQrPng`, `renderQrSvg`; `qrcode` package).

## Rendering robustness (2026-07 hardening)

All four renderers share these guarantees:

- **WinAnsi sanitizing at every draw/measure boundary**:
  `sanitizeWinAnsiText` (CP1252 passthrough, fold map, NFKD fallback) -
  pdf-lib's standard fonts throw on non-WinAnsi code points, so no
  string reaches `drawText`/`widthOfTextAtSize` unsanitized.
- **Exact greedy wrapping**: `wrapTextLines(value, font, size, maxW)`
  measures with the real font metrics and hard-breaks over-long words
  char-level (replaced the old estimated `wrapLineCount`).
- **Row-level page breaks with repeated table heads**: position tables
  break BETWEEN rows and re-draw the head on the continuation page;
  only rows taller than a whole page body split line-wise.
- **Measured totals block**: the totals/summary block is measured first
  and moves to a continuation page in one piece rather than splitting.
- **Per-rate MwSt lines** for mixed-tax invoices; Kopftext
  (`documents.header`) and discount notes are rendered.
- **Shrink-to-fit header rails** (company / meta / address / vehicle
  columns).
- **"Seite X von Y" on every page** (patched in a final pass once the
  page count is known).
- **Byte-deterministic renders**: PDF-internal dates derive from the
  entity's `updatedAt`, so the same input always yields identical bytes
  (required by the `inputHash` cache AND the visual snapshots below).

## Visual regression harness

`src/lib/server/services/pdf-visual.test.ts` - a 15-fixture snapshot
matrix (invoices incl. 45-position/3-page, mixed tax + discount, long
descriptions, special chars, storno, from-order; offer with Kopftext;
order confirmation; reminder; sale sign; tire label) plus
pagination-structure and determinism tests:

- Pages are rasterized with poppler's `pdftoppm` (72 dpi) and compared
  by a pure-node pixel differ: a pixel counts as different above a
  channel delta of 32; a page fails above 0.5 % differing pixels.
- Committed snapshots live in
  `src/lib/server/services/__pdf_snapshots__/*.png`; refresh via
  `PDF_SNAPSHOTS=update pnpm exec vitest run pdf-visual`.
- The suite skips itself when `pdftoppm` is not installed (CI-safe).

## Related outputs that are NOT PDFs

- [[xrechnung]] - UBL 2.1 XML sidecar sharing `DocumentRenderInput`.
- [[datev]] - CP1252 CSV Buchungsstapel.

The legacy import renders ~10.5k PDFs during a full run (its heaviest
phase); dry runs skip rendering ([[kfz-kaufmann-import]]).
