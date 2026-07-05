---
title: Module - setup (Ersteinrichtung)
tags: [module, setup, wizard]
updated: 2026-07-05
---

# setup - first-run wizard

- **Purpose**: gate the whole app until configured. Until
  `company_settings.setupCompleted = true`, every route redirects to
  `/setup` (checked app-side; `/setup` is in the auth whitelist).
- **Route**: `/setup` (single page, `WizardHost.svelte`).
- **Steps** (8): 1 Willkommen · 2 Firmendaten · 3 Steuer & Bank ·
  4 Logo & Anrede · 5 E-Mail (SMTP) · 6 Öffnungszeiten ·
  7 Administrator · 8 Verifikation. The legacy import is deliberately
  NOT a step ([[import]]).
- **Remote** `setup.remote.ts`: `getSetupStatus`, `saveCompanyData`,
  `saveSmtp`, `createInitialAdmin`, `listWorkshopHoursForSetup`,
  `saveWorkshopHoursForSetup`, `completeSetup`.
- **Server-enforced rules**:
  - `companyDataSchema` requires tax number + bank details server-side
    (no API bypass); the company row is persisted once all required
    fields are present.
  - SMTP is skippable ("Später einrichten"); logo optional.
  - `completeSetup` refuses unless an admin exists AND company
    name/address/email are persisted.
  - The first admin gets the Administrator role
    ([[auth-and-permissions]]).
- **Side effects of completion**: seeds default mail templates, ledger
  categories, number ranges (also seeded idempotently on first request
  by `seedDefaults()` in hooks).
- **Known polish item**: a fresh install hits `/` → redirect to
  `/login` → client redirect to `/setup` (one visible flash).
- **Tests**: `setup.remote.test.ts`, `wizard.test.ts`.
