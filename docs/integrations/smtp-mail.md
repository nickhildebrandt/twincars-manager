---
title: Integration - SMTP mail pipeline
tags: [integration, mail, smtp, nodemailer]
updated: 2026-07-10
---

# SMTP / mail pipeline

All sending goes through `src/lib/server/services/mail-service.ts`
(nodemailer, SMTP only - no API providers). Connection from
`smtp_settings` (host, port, secure mode none/STARTTLS/TLS, credentials,
from/reply-to; the `verified` flag is reset to `false` on every save by
`smtp-settings-service.ts` and is currently set `true` by no code path -
a dormant column).

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
- `sendSmtpTestMail` - the "Testversand" (2026-07): sends a minimal
  German test mail through the currently **persisted** `smtp_settings`
  row (unsaved form values never reach it; the UI shows a dirty hint).
  Builds its own transport with hard 10 s connection/greeting/socket
  timeouts and maps every failure class to a fixed German message
  (`mapSmtpTestError`): server not found (DNS), connection refused,
  auth failed, recipient rejected, timeout, TLS/certificate, generic
  fallback - raw errors go to the server console only, credentials
  never leak. Deliberately NOT recorded in `sent_messages`
  (infrastructure check, not correspondence). Exposed as
  `sendSmtpTestMailRemote` (`requirePermission('settings')`, recipient
  validated, in-flight flag + 5 s cooldown → 429 on double-fire); UI
  component `src/routes/settings/SmtpTestSend.svelte` below the SMTP
  form at `/settings/smtp` ([[settings]]) - recipient prefilled from
  the company email, click-time validation, success toast, inline
  `role="alert"` failure.

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

## Password at rest

`smtp_settings.password` is **encrypted at rest** (AES-256-GCM via
`$lib/server/crypto`, [[adr-005-encryption-scope]]). The
encrypt-and-upsert is centralized in
`src/lib/server/services/smtp-settings-service.ts`
(`upsertSmtpSettings`, used by both the setup and settings remotes;
an empty password input keeps the stored value). Reads go through
`decryptSecretIfNeeded`, which passes legacy plaintext rows through.
