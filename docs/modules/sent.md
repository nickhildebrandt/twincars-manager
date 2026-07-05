---
title: Module - sent (Gesendet)
tags: [module, sent, email, audit]
updated: 2026-07-05
---

# sent - "Gesendet" (mail audit)

- **Purpose**: read-only audit trail of every mail the system sent
  (document mails, ad-hoc, broadcasts, appointment confirmations).
- **Routes**: `/sent`, `/sent/[id]`.
- **Remote** `sent.remote.ts`: `listSentRemote`, `getSentMessageRemote`.
  Guard: `invoices` permission (nav entry keys on `invoices`).
- **Tables**: `sent_messages` - recipient, subject, `bodyText` (always
  plain text, even for HTML sends - the audit stores the derived
  fallback), `attachmentMeta` jsonb (names + sizes only, never bytes),
  status `sent`/failed + `errorMessage`, `smtpMessageId`, optional
  `documentId` + `documentType` (`invoice`, `offer`, `reminder`,
  `mailing`, ...).
- **Special**: legacy-imported documents deliberately do NOT appear here
  (they were not sent by this system). Broadcasts create one row per
  recipient ([[mailings]]).
- **Tests**: covered by `mail-service.test.ts` assertions on the audit
  writes.
