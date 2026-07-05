---
title: Integration - SMTP mail pipeline
tags: [integration, mail, smtp, nodemailer]
updated: 2026-07-05
---

# SMTP / mail pipeline

All sending goes through `src/lib/server/services/mail-service.ts`
(nodemailer, SMTP only - no API providers). Connection from
`smtp_settings` (host, port, secure mode none/STARTTLS/TLS, credentials,
from/reply-to, `verified` flag set by the settings test-send).

## Send paths

- `sendDocumentEmail` - invoice/offer/reminder mails: renders a
  `{platzhalter}` template (`loadTemplate` → `buildVars` → `render`,
  templates in `mail_templates`, editable at [[settings]]) and attaches
  the cached PDF ([[pdf-pipeline]]).
- `sendAdHocCustomerEmail` - free-form mail from the customer detail
  ([[customers]]); optional attachments; optional `asHtml`.
- `sendBroadcastEmail` - Rundschreiben ([[mailings]]): BCC batches of 50,
  per-customer failure records, unsubscribe footer + `List-Unsubscribe`
  mailto header ([[adr-017-broadcast-unsubscribe-mailto]]).
- `sendAppointmentConfirmation` - public booking confirmations
  ([[public-rest-api]]).
- `sendContactNotification` + `recordInquiryNotificationResult` -
  internal notification for website inquiries; the inquiry row is
  persisted BEFORE sending so SMTP outages never lose data; failed
  sends retried from `/settings/inquiries`.

## Conventions (CONTRIBUTING §18)

- Plain text is the default; every send passes `text`.
- HTML is opt-in (`asHtml`): body treated as operator-authored HTML,
  sent as `html` with an `htmlToPlainText` fallback; the
  `sent_messages.bodyText` audit ALWAYS stores plain text.
- Every send writes a `sent_messages` row ([[sent]]) - broadcasts one
  per recipient (`documentType='mailing'`).
- Test at the nodemailer boundary: mock
  `nodemailer.createTransport().sendMail` and assert on captured
  options (`mail-service.test.ts`).

## Local development

`node scripts/dev-mail-catcher.js` - SMTP catcher on `127.0.0.1:1025`
writing timestamped `.eml` files to `tmp/mail/`. Point `smtp_settings`
at it (`host=127.0.0.1 port=1025 secure=none`). See [[dev-environment]].

## Open security item

`smtp_settings.password` is stored plaintext (migration 0021 made it
so deliberately for SMTP round-trips); encrypting it with the
[[adr-005-encryption-scope]] crypto helper is on the security backlog.
