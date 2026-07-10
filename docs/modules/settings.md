---
title: Module - settings (Einstellungen)
tags: [module, settings]
updated: 2026-07-10
---

# settings - "Einstellungen"

Umbrella for app configuration. The sidebar's "System" group contains
exactly ONE entry, "Einstellungen"; everything settings-shaped (incl.
Import and eBay) lives inside `/settings`. The one exception is
**"Anfragen"**: the page keeps living at `/settings/inquiries` but is
navigated from the **Kommunikation** group (daily communication work,
not administration; still the `mailings` permission).

## Flat navigation (2026-07, one tab level)

`src/routes/settings/+layout.svelte` renders ONE permission-filtered
tab bar using the standard `TabGroup` in **navigation mode** (tabs are
routes; the active tab derives from the pathname and survives cancelled
navigations - [[styling]]). The former nested `?tab=` areas on
`/settings` are own routes now; **legacy `?tab=` deep links redirect**
(handled in `/settings/+page.svelte`).

Tabs (id → route → permission): Allgemein → `/settings` (`settings`),
Mailvorlagen → `/settings/mail` (`settings`), Zahlungserinnerung →
`/settings/reminders` (`settings`), SMTP → `/settings/smtp`
(`settings`), Benutzer & Rollen → `/settings/users` (`users`),
Öffnungszeiten → `/settings/workshop-hours` (`settings`),
Reifen-Erinnerungen → `/settings/tire-reminders` (`settings`),
Anfragen → `/settings/inquiries` (`mailings`), eBay → `/settings/ebay`
(`settings`), Import → `/settings/import` (`import`), Konto →
`/settings/account` (any signed-in user).

## The pages

- `/settings` (Allgemein) - **Firmendaten**: company data incl. geo
  coordinates, §19 UStG flag, logo, and the "Stundensatz" fieldset (the
  workshop labor rate, i.e. the current price of the designated
  "Arbeitszeit" item used by [[orders]]).
- `/settings/mail` - **Mailvorlagen** with `{platzhalter}`,
  reset-to-default.
- `/settings/reminders` - **Zahlungserinnerung** (reminderDays1 /
  reminderRecurEveryDays / auto toggle).
- `/settings/smtp` - **SMTP** connection form plus the **Testversand**
  card (`SmtpTestSend.svelte`, below the form): sends a test mail
  through the persisted settings via `sendSmtpTestMailRemote`
  (click-time recipient validation, curated German failure inline as
  `role="alert"`, dirty hint when unsaved SMTP edits exist, 5 s
  double-fire guard → 429). Details in [[smtp-mail]].
- `/settings/users` (+ `/new`, roles) - user CRUD, role matrix
  (`RoleForm.svelte`), deactivation toggle; Benutzer and Rollen are
  stacked card sections (no nested tabs); `users.remote.ts` (`users`
  permission). See [[auth-and-permissions]].
- `/settings/account` - own password change (`account.remote.ts`, any
  signed-in user).
- `/settings/ebay` - eBay connect/disconnect + the Phase-2 listing
  import (import card with last-run summary, paginated/searchable
  listings table; `ebay.remote.ts`, `EbayHost.svelte`); see [[ebay]].
- `/settings/import` - the Kfz-Kaufmann import UI
  (`import.remote.ts`: `runMdbImportRemote`, `getImportProgressRemote`
  polling the `access_import_jobs` progress bar); `import` permission.
  See [[import]] and [[kfz-kaufmann-import]].
- `/settings/workshop-hours` - opening hours per weekday
  (`workshop-hours.remote.ts`); drives public free slots. The input
  schema enforces a cross-field rule via Valibot `check`: on an open
  day `opensAt < closesAt` ("Die Öffnungszeit muss vor der
  Schließzeit liegen."); `closed` days skip the check.
- `/settings/inquiries` - contact-form inquiries from the website with
  notification retry (`inquiries.remote.ts`, `mailings` permission);
  sidebar entry "Anfragen" in the Kommunikation group.
- `/settings/tire-reminders` - seasonal tire-mail preview + send
  (`tire-reminders.remote.ts`); see [[tire-storage]].

## Remote `settings.remote.ts`

`getAllSettingsRemote`, `updateCompanyRemote`,
`updateReminderSettingsRemote`, `updateLogoRemote`, `removeLogoRemote`,
`listMailTemplatesRemote`, `updateMailTemplateRemote`,
`resetMailTemplateRemote`, `updateSmtpRemote` (encrypt-and-upsert via
`smtp-settings-service.ts`), `sendSmtpTestMailRemote`,
`getLaborRateSettingRemote`, `updateLaborRateRemote` (each rate change
writes a NEW `item_price_versions` row so history and existing
snapshots stay intact - [[adr-007-price-snapshots-and-versions]]).
Guard `requirePermission('settings')`. Service: `settings-service.ts`.

## Tables

`company_settings`, `smtp_settings`, `mail_templates`,
`workshop_hours`, `customer_inquiries`, `users` /
`roles` / `role_permissions`, `ebay_credentials`, `ebay_listings`,
`ebay_import_runs`, `access_import_jobs`.

## Tests

`settings-service.test.ts`, `settings.remote.test.ts` (labor rate,
SMTP test send guard/cooldown), `SmtpTestSend.test.ts`,
`users.remote.test.ts`, `account.remote.test.ts`,
`inquiries.remote.test.ts`, `ebay.remote.test.ts` +
`ebay-page.test.ts`, `RoleForm.test.ts`,
`workshop-hours-service.test.ts`, `e2e/settings.spec.ts` (every tab
reachable with exactly one tablist, legacy `?tab=` redirect, SMTP
click-time validation, import file validation, eBay disconnected
path).
