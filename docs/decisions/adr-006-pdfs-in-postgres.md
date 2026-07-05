---
title: ADR-006 - PDFs stored in Postgres (bytea + input hash)
tags: [adr, pdf, storage]
updated: 2026-07-05
---

# ADR-006: PDFs live in the database

**Status**: accepted, enforced.

## Context

Single-tenant workshop app on one VM. A separate object store (S3,
filesystem volume) adds moving parts for a few thousand small PDFs.

## Decision

Store rendered PDF bytes in `document_pdfs`/`reminder_pdfs` (`bytea`)
together with an `inputHash` over the canonical render input. Re-render
only when the hash changes; serve cached bytes otherwise. Keep bytea out
of list queries - metadata remotes never carry bytes; a single global
`pdfs.remote.ts` exposes meta and bytes separately.

Images (vehicle/tire/post/absence attachments) follow the same
philosophy as inline base64 text/jsonb.

## Consequences

- One backup artifact covers everything ([[backup-and-restore]]).
- DB size grows with documents (~10.5k PDFs after a full legacy
  import) - acceptable at this scale.
- Cheap renderers (labels, sale signs) skip caching entirely.
- Details: [[pdf-pipeline]].
