---
title: Module - sales-ledger (Rechnungsausgangsbuch)
tags: [module, sales-ledger, accounting]
updated: 2026-07-05
---

# sales-ledger - "Rechnungsausgangsbuch"

- **Purpose**: read-only chronological register of outgoing invoices for
  bookkeeping/tax purposes with period filters and totals.
- **Route**: `/sales-ledger` (list only - no detail/new/edit; rows click
  through to [[invoices]]).
- **Remote** `sales-ledger.remote.ts`: a period-filtered query over
  `documents` joined to `customers`; filter schema accepts `from`/`to`
  ISO dates or `period` presets (`this_month`, `last_month`,
  `this_year`, `all`); explicit dates win over the preset. Guard
  `requirePermission('ledger')` (shares the ledger permission).
- **Tables**: `documents` (type invoice incl. storno rows), `customers`.
- **Special**: totals row in `<tfoot>` per [[styling]]; this is a view,
  not a ledger - actual expense/income entries live in [[ledger]].
- **Tests**: covered via `document-service.test.ts`; no dedicated file.
