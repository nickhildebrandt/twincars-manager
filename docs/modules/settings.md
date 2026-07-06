---
title: Module - settings (Einstellungen)
tags: [module, settings]
updated: 2026-07-06
---

# settings - "Einstellungen"

Umbrella for app configuration. NOTE: consolidation is in progress
(2026-07): Import and eBay are being folded INTO the Einstellungen tab
surface; the extra sidebar entries remain only for users whose sole
grant is a sub-permission. Verify current tab layout in
`src/routes/settings/+page.svelte` before relying on this list.

## `/settings` (tabbed page, `?tab=` mirrored in URL)

Tabs: **Firmendaten** (company data incl. geo coordinates, §19 UStG
flag, logo, and the "Stundensatz" fieldset - the workshop labor rate,
i.e. the current price of the designated "Arbeitszeit" item used by
[[orders]]), **Mailvorlagen** (mail templates with `{platzhalter}`,
reset-to-default), **Zahlungserinnerung** (reminderDays1 /
reminderRecurEveryDays / auto toggle), **SMTP** (connection +
verification). Remote `settings.remote.ts`: `getAllSettingsRemote`,
`updateCompanyRemote`, `updateReminderSettingsRemote`,
`updateLogoRemote`, `removeLogoRemote`, `listMailTemplatesRemote`,
`updateMailTemplateRemote`, `resetMailTemplateRemote`,
`updateSmtpRemote`, `getLaborRateSettingRemote`,
`updateLaborRateRemote` (each rate change writes a NEW
`item_price_versions` row so history and existing snapshots stay
intact - [[adr-007-price-snapshots-and-versions]]). Guard
`requirePermission('settings')`. Service: `settings-service.ts`.

## Sub-pages

- `/settings/users` (+ `/new`, roles) - user CRUD, role matrix
  (`RoleForm.svelte`), deactivation toggle; `users.remote.ts`
  (`users` permission). See [[auth-and-permissions]].
- `/settings/account` - own password change (`account.remote.ts`,
  any signed-in user).
- `/settings/ebay` - eBay connect/disconnect (`ebay.remote.ts`,
  `EbayHost.svelte`); see [[ebay]].
- `/settings/import` - the Kfz-Kaufmann import UI
  (`import.remote.ts`: `runMdbImportRemote`, `getImportProgressRemote`
  polling the `access_import_jobs` progress bar); `import` permission.
  See [[import]] and [[kfz-kaufmann-import]].
- `/settings/workshop-hours` - opening hours per weekday
  (`workshop-hours.remote.ts`); drives public free slots.
- `/settings/inquiries` - contact-form inquiries from the website with
  notification retry (`inquiries.remote.ts`, `mailings` permission).
- `/settings/tire-reminders` - seasonal tire-mail preview + send
  (`tire-reminders.remote.ts`); see [[tire-storage]].

## Tables

`company_settings`, `smtp_settings`, `mail_templates`,
`workshop_hours`, `customer_inquiries`, `users` /
`roles` / `role_permissions`, `ebay_credentials`, `access_import_jobs`.

## Tests

`settings-service.test.ts`, `settings.remote.test.ts` (labor rate),
`users.remote.test.ts`,
`account.remote.test.ts`, `inquiries.remote.test.ts`,
`ebay.remote.test.ts` + `ebay-page.test.ts`, `RoleForm.test.ts`,
`workshop-hours-service.test.ts`.
