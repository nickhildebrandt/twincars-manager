---
title: Module - tire-storage (Reifeneinlagerung)
tags: [module, tire-storage, tires]
updated: 2026-07-05
---

# tire-storage - "Reifenlager / Reifeneinlagerung"

- **Purpose**: manage customer-owned tire sets stored at the workshop,
  with QR labels that phone-scan straight to the entry.
- **Routes**: `/tire-storage`, `/tire-storage/new`, `/tire-storage/[id]`,
  `/tire-storage/[id]/edit`, `/tire-storage/scan/[number]` (QR resolver:
  looks up the storage number and redirects to the detail page).
- **Remotes**:
  - `tire-storage.remote.ts`: `listTireStorageRemote`,
    `getTireStorageRemote`, `resolveTireStorageByNumberRemote`,
    `createTireStorageRemote`, `updateTireStorageRemote`,
    `markRetrievedRemote`, `deleteTireStorageRemote`.
  - `labels.remote.ts`: A6 QR label via `renderTireStorageLabelPdf`
    (Nummer / Kunde / Reifensatz / QR; payload
    `{origin}/tire-storage/scan/<storageNumber>`) - [[pdf-pipeline]].
  - Guard `requirePermission('tires')` (shares the tires module key).
- **Service**: `tire-storage-service.ts` (incl.
  `getTireStorageIdByNumber`).
- **Tables**: `tire_storage` (storageNumber unique from range
  `L-{YYYY}-{NNNN}`; customer FK restrict; season
  `summer`|`winter`|`allseason`; `retrievedAt` null = still stored;
  inline photos jsonb), `tire_reminder_log`.
- **Special**:
  - Seasonal tire-change reminder mails
    (`tire-reminder-service.ts`: `findTireReminderCandidates`,
    `previewTireReminderCandidates`, `sendTireReminders`) - only
    customers with `wantsTireReminders` AND an active storage row;
    `tire_reminder_log` unique (customer, season, year) makes the job
    idempotent per season (`spring` mid-March = Sommerräder, `autumn`
    mid-October = Winterräder). Operator-triggered from
    `/settings/tire-reminders` ([[adr-009-no-in-process-scheduler]]).
  - Legacy `reifenlager` rows are imported with dedup-suffixed storage
    numbers so nothing is lost ([[kfz-kaufmann-import]]).
- **Tests**: `tire-storage-service.test.ts`,
  `tire-reminder-service.test.ts`, `TireStorageForm.test.ts`,
  `labels.remote.test.ts`.
