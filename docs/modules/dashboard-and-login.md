---
title: Module - dashboard and login
tags: [module, dashboard, login, shell]
updated: 2026-07-05
---

# dashboard ("Start") and login

## Dashboard `/`

- `src/routes/+page.svelte` + `dashboard.remote.ts`:
  `getDashboardKpis` (KPI tiles) and
  `getUpcomingRemote` (upcoming HU/AU, appointments, etc.).
- The "Start" nav item is the only entry visible without any module
  permission.

## Login `/login`

- `src/routes/login/+page.svelte` - better-auth username sign-in,
  client-side call to `/api/auth/sign-in/username`. Reads
  `?redirectTo=` to bounce back after login.
- Errors surfaced directly from the auth response: rate-limit 429
  ("Zu viele Anmeldeversuche...") and deactivated-account 403 messages
  come from `hooks.server.ts` ([[auth-and-permissions]]).
- E2E selectors: `input[autocomplete="username"]`,
  `input[type="password"]`, `button:has-text("Anmelden")`
  ([[dev-environment]]).

## Shell / layout plumbing

- `src/routes/+layout.svelte` - AppShell (sidebar + header + the single
  progress bar, [[loading-and-busy]]), `beforeNavigate`/`afterNavigate`
  busy wiring, service-worker registration in production
  ([[pwa-service-worker]]), toast tray, unsaved-changes guard.
- `src/routes/layout.remote.ts` - `getLayoutContext`,
  `getCurrentUserRemote` (returns `null` for anonymous callers - the
  documented guard exception, [[remote-functions]]).
- Header title/primary actions render in the shell bar via `PageHeader`,
  NOT in the page body (matters for E2E assertions).
- Global search box: [[search]].
- Root `+error.svelte`: curated German error page
  ([[validation-and-errors]]).
