---
title: Module - import (Kfz-Kaufmann Import UI)
tags: [module, import]
updated: 2026-07-10
---

# import - "Import (Kfz-Kaufmann)"

The UI/remote wrapper around the legacy migration. The full mapping,
rules and quirks live in [[kfz-kaufmann-import]].

- **Route**: `/settings/import` (moved from a top-level `/import`;
  deliberately NOT a setup-wizard step - the wizard lacks the progress
  UI).
- **Remote** `src/routes/settings/import/import.remote.ts`:
  - `runMdbImportRemote` - takes the base64 `.mdb` upload (needs
    `BODY_SIZE_LIMIT=64M`) and a `dryRun` flag.
  - `getImportProgressRemote` - polls the running
    `access_import_jobs` row (`progress` 0-100 + German
    `progressLabel`) for the live progress bar.
  - Guard `requirePermission('import')`.
- **UI flow**: "Vorschau (ohne Speichern)" (dry run; blue "nichts
  gespeichert" banner) → "Jetzt wirklich importieren". Result modal
  shows per-table counts plus a collapsible per-row drop table
  (table / legacy key / German reason).
- **Service**: `import-service.ts` (see [[kfz-kaufmann-import]]).
- **Safety**: read-before-wipe, dry-run, structured skip report, audit
  row even on failure ([[adr-004-import-wipe-first-read-before-wipe]]).
- **eBay customer detection** (2026-07): the customer mapping sets
  `kind='ebay'` via `isEbayCustomerName`
  (`src/lib/utils/ebay-detection.ts`) - import-time only, details in
  [[kfz-kaufmann-import]].
- **Tests**: `import-service.test.ts` (transform helpers + full pipeline
  through a mocked `mdb-export` boundary).
