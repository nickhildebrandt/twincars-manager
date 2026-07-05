---
title: Integration - DATEV export
tags: [integration, datev, accounting]
updated: 2026-07-05
---

# DATEV CSV export (Buchungsstapel)

CSV in the DATEV "Format" (EXTF header, version 7.0) that the
Steuerberater imports into DATEV Rechnungswesen.

- **Service**: `src/lib/server/services/datev-export-service.ts` -
  `exportDatevCsv(from, to, ...)` over `documents` (sales invoices) and
  `ledger_entries`.
- **Remote**: `src/routes/ledger/datev.remote.ts` (export from the
  [[ledger]] page; `ledger` permission).
- **File shape**: line 1 EXTF header ("Buchungsstapel"), line 2 fixed
  column header, then one posting per row. Populated columns: Umsatz,
  S/H-Kennzeichen, WKZ (EUR), Konto, Gegenkonto, Belegdatum (DDMM),
  Belegfeld 1 (document number), Buchungstext; all other columns are
  empty semicolon placeholders.
- **Encoding**: DATEV requires CP1252. The service returns a Latin-1
  string whose `charCodeAt` values ARE the CP1252 bytes; the caller
  base64-encodes for the wire.
- **Account mapping** (SKR03-oriented minimal defaults - the tax
  advisor remaps anyway): sales invoices → 8400 vs 1400; ledger income
  without category → like invoices; material expenses → 3400 vs 1600;
  other expenses → 4980 vs 1600.
- **Tests**: `datev-export-service.test.ts`.

Related: [[ledger]], [[sales-ledger]], [[xrechnung]].
