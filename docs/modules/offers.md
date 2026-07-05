---
title: Module - offers (Angebote / Kostenvoranschläge)
tags: [module, offers, documents]
updated: 2026-07-05
---

# offers - "Angebote / Kostenvoranschläge"

- **Purpose**: create and manage `offer` / `cost_estimate` /
  `order_confirmation` documents and convert them to invoices.
- **Routes**: `/offers`, `/offers/new`, `/offers/[id]`,
  `/offers/[id]/convert` (conversion form with payment terms).
- **Remote** `offers.remote.ts`: `listOffersRemote`, `getOfferRemote`,
  `createOfferRemote`, `deleteOfferRemote`,
  `convertOfferToInvoiceRemote`, `cancelOfferRemote`,
  `markOfferSentRemote`, `sendOfferRemote` (mail with PDF attachment).
  Guard `requirePermission('offers')`.
- **Service**: `document-service.ts` (shared with [[invoices]];
  `convertOfferToInvoice` accepts offer/KV/AB types, flips status to
  `converted`, links `convertedToInvoiceId`).
- **Tables**: `documents`, `document_items`, `document_pdfs`.
- **Special**:
  - Positions via `SearchablePicker` against items/tires; price/tax
    snapshots per [[adr-007-price-snapshots-and-versions]].
  - PDF preview via [[pdf-pipeline]]; sending records a
    `sent_messages` row ([[sent]]).
  - Legacy import: offer positions link via `Angebotsnummer`; orphaned
    positions are collected under a generated "Sammel-Angebot"
    (`AN-IMPORT-SAMMEL-<year>`) - [[kfz-kaufmann-import]].
- **Tests**: `document-service.test.ts` covers creation/conversion.
