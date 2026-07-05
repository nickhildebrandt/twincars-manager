---
title: Module - mailings (Rundschreiben)
tags: [module, mailings, email]
updated: 2026-07-05
---

# mailings - "Rundschreiben" (broadcast email)

- **Purpose**: broadcast mail to all opted-in customers, with recipient
  preview and history.
- **Route**: `/mailings` (composer + history; no sub-routes).
- **Remote** `mailings.remote.ts`:
  `previewBroadcastRecipientsRemote`, `sendBroadcastEmailRemote`,
  `listBroadcastHistoryRemote`, `countBroadcastsRemote`. Guard
  `requirePermission('mailings')`.
- **Service**: `mail-service.ts` (`sendBroadcastEmail`) - details in
  [[smtp-mail]].
- **Tables**: `customers` (`wantsBroadcast` + email = recipient set via
  `listCustomersForBroadcast`), `sent_messages` (one row PER recipient,
  `documentType='mailing'`), `smtp_settings`.
- **Special behavior**:
  - Recipients in **BCC**, chunked 50 per envelope
    (`BROADCAST_BCC_BATCH`); a failed batch is recorded per customer
    and does not abort the rest.
  - Optional operator-authored HTML (`asHtml` toggle in the shared
    `EmailComposer`); plain-text fallback derived via `htmlToPlainText`
    is what the audit stores.
  - German "Abbestellen" footer + `List-Unsubscribe` mailto header on
    every broadcast; opt-out is a mailto reply, the operator flips
    `wantsBroadcast` ([[adr-017-broadcast-unsubscribe-mailto]]).
  - Ad-hoc single-customer mails ([[customers]]) get NO footer.
- **Tests**: `mailings.remote.test.ts`, `mail-service.test.ts`
  (nodemailer boundary), `EmailComposer` component tests.
