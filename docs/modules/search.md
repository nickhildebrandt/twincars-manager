---
title: Module - search (Globale Suche)
tags: [module, search]
updated: 2026-07-05
---

# search - "Globale Suche"

- **Purpose**: one search box in the AppShell header that fans out over
  all major entities and jumps to detail pages.
- **Files**: `src/routes/search.remote.ts` (`globalSearchRemote`),
  `src/lib/server/services/search-service.ts` (`globalSearch`),
  `GlobalSearch.svelte` component in the shell.
- **Buckets** (each capped, ILIKE server-side, deterministic order):
  customers, vehicles, items, tires, tire-storage
  ("ausgelagert" marker for retrieved sets), suppliers (archived
  excluded), employees, documents (invoice/offer/KV/AB with type label
  - number), posts.
- **Permission gating**: `search.remote.ts` drops buckets the caller has
  no module permission for (e.g. tires/tire-storage need `tires`,
  suppliers needs `suppliers`).
- **Limits**: hits capped per bucket (8), no pagination - "jump to the
  module list" is the escape hatch. Speed/coverage expansion is a
  planned work item.
- **Tests**: `search-service.test.ts` (bucket queries),
  `search.remote.test.ts` (permission gating), `GlobalSearch`
  component navigation tests.
