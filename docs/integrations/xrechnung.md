---
title: Integration - XRechnung (e-invoice XML)
tags: [integration, xrechnung, einvoice]
updated: 2026-07-05
---

# XRechnung 3.0 / UBL 2.1

From 2026, German B2B invoices must exist in a structured electronic
format (EN 16931). The app generates the **XRechnung CIUS as a plain
UBL 2.1 Invoice XML** - a sidecar download next to the classic PDF (no
ZUGFeRD / PDF/A-3 embedding).

- **Service**: `src/lib/server/services/xrechnung-service.ts` -
  `renderXRechnungXml(input)`; shares `DocumentRenderInput` with the PDF
  renderer so both representations carry identical master data.
- **Remote**: `src/routes/invoices/xrechnung.remote.ts` (invoice detail
  page offers the download; `invoices` permission).
- **Formatting rules**: amounts dotted 2-decimals, quantities fixed
  4 decimals, ISO dates, XML-escaped strings.
- **Kleinunternehmer (§19 UStG)**: when
  `company_settings.smallBusinessExempt` is set, the whole
  TaxTotal/TaxSubtotal block is omitted; lines are tagged
  `TaxCategory/ID = E` with the German notice as `TaxExemptionReason`.
- **Deliberately omitted**: fields without an XRechnung counterpart
  (vehicle reference, internal footer).
- **Tests**: `xrechnung-service.test.ts`.

Reference: https://xeinkauf.de/xrechnung/versionen-und-bundles/

Related: [[invoices]], [[pdf-pipeline]], [[datev]].
