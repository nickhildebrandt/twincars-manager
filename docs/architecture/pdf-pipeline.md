---
title: PDF pipeline
tags: [architecture, pdf, pdf-lib]
updated: 2026-07-05
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
- `renderArticleLabelPdf` - A6 landscape QR label for an item; QR payload
  `{origin}/items/<articleNumber>`; uncached (cheap, always fresh).
  Exposed via `src/routes/items/labels.remote.ts`.
- `renderTireStorageLabelPdf` - A6 QR label for a Reifeneinlagerung
  (Nummer / Kunde / Reifensatz / QR); QR payload
  `{origin}/tire-storage/scan/<storageNumber>` so a phone scan resolves
  to the detail page. Exposed via
  `src/routes/tire-storage/labels.remote.ts`.
- `renderVehicleSaleSignPdf` - A4 landscape "Verkaufsschild" (dark header
  band, photo panel, red price panel honoring `differentialTax` /
  "Preis auf Anfrage", facts table from real vehicle columns
  fuelType/gearbox/colorCode/displacementCcm/powerKw/bodyType, footer
  with highlights + QR). Exposed via
  `src/routes/vehicles/sale-sign.remote.ts`.

QR codes come from `src/lib/server/services/qr-service.ts`
(`renderQrPng`, `renderQrSvg`; `qrcode` package).

## Related outputs that are NOT PDFs

- [[xrechnung]] - UBL 2.1 XML sidecar sharing `DocumentRenderInput`.
- [[datev]] - CP1252 CSV Buchungsstapel.

The legacy import renders ~10.5k PDFs during a full run (its heaviest
phase); dry runs skip rendering ([[kfz-kaufmann-import]]).
