---
title: Auth and permissions
tags: [architecture, auth, rbac, security]
updated: 2026-07-05
---

# Auth and permissions

## Identity - better-auth, username only

`src/lib/server/auth.ts`: better-auth with the `username` plugin.
Username + password only; email signup disabled (`disableSignUp: true`),
no OAuth, no magic links. The admin creates accounts from
`/settings/users`; the very first admin is created in the [[setup]]
wizard. better-auth needs an email internally, so a stable
`<username>@twincars.local` is synthesized - it never leaves the server.
Password 8..128 chars, bcrypt in `accounts.password`. Cookie prefix `tcm`.
Sessions: 7 days, refreshed daily, 5-minute cookie cache.
`APP_SECRET` is the HMAC cookie-signing secret (NOT data encryption -
see [[adr-005-encryption-scope]]). Rationale: [[adr-013-username-only-auth]].

## Request pipeline (`src/hooks.server.ts`)

Order of the composed `handle`:

1. `ensureSeeded()` - idempotent `seedDefaults()` on first request (mail
   templates, ledger categories, number ranges, workshop hours, roles).
2. `rateLimitSignIn` - POST `/api/auth/sign-in/*` bucketed per client IP
   at 10/min (`rate-limit.ts`); 429 with German message + Retry-After.
   Client IP: first `x-forwarded-for` entry, else `getClientAddress()`.
3. `blockDeactivatedSignIn` - rejects sign-in for `users.active=false`
   with a curated 403 German message before better-auth sees it (no
   account enumeration for unknown usernames).
4. better-auth `svelteKitHandler` (the catch-all).
5. `populateAuthLocals` - fills `event.locals.{session,user,permissions}`;
   re-checks `active` against the DB on EVERY request so deactivation
   beats the 5-minute cookie cache.
6. `requireAuthHandle` - redirects unauthenticated visitors of non-public
   routes to `/login?redirectTo=...`. Public prefixes: `/login`,
   `/api/auth`, `/api/public`, `/api/ebay/account-deletion`, `/setup`,
   `/_app`, `/favicon`.

## Authorization - per-module RBAC

Decision record: [[adr-002-per-module-permissions]].

- Canonical keys in `src/lib/permissions.ts` (`MODULE_PERMISSIONS`), one
  key per module: `customers`, `vehicles`, `suppliers`, `employees`,
  `items`, `offers`, `invoices`, `reminders`, `ledger`, `calendar`,
  `inventory`, `hours`, `mailings`, `import`, `settings`, `users`,
  `tires`, `shipping`, `posts`. Wildcard `*` grants everything.
- The ONE sub-key: `hours:write_own` - self-service time logging
  (employee sees/edits only own entries). `hours` = full/manager level.
- Guards in `src/lib/server/auth-guards.ts`: `requireUser()`,
  `requirePermission(key)`, `requireAnyPermission(...keys)`. First
  statement of every remote body ([[remote-functions]]).
- `src/lib/server/auth-permissions.ts` adds the DB loader
  `loadUserPermissions(userId)` (union of role permissions).

## Roles (seeded, `seed-defaults.ts`)

- **Administrator**: `*`. Undeletable role; the last user effectively
  holding `*` cannot be deleted or deactivated.
- **Werkstattleiter**: every module except `settings`/`users` (built via
  flatMap over `MODULE_PERMISSIONS`, so new modules are auto-granted).
- **Mitarbeiter** (curated list): customers, vehicles, suppliers, items,
  offers, invoices, reminders, calendar, inventory, tires +
  `hours:write_own`. New modules are added deliberately, not
  automatically.

Role CRUD + matrix UI at `/settings/users` (`RoleForm.svelte`: one
"Zugriff" checkbox per module; hours has "Alle Stunden" vs
"Nur eigene Stunden").

## User deactivation

`users.active` (migration 0027). Deactivation force-deletes the user's
sessions (`deleteUserSessions` in `auth-users.ts`); sign-in blocked at
POST and on every request. UI: Status badge + toggle on the users page.

## Navigation filtering

Sidebar items in `src/lib/components/layout/navigation.ts` carry an
optional `permission` key; `filterNavigationByPermissions` drops items and
empty groups (`*` short-circuits). A user with no matching permissions
sees only the bare "Start" item.

Related: [[public-rest-api]] (separate Bearer-token auth for external
consumers, [[adr-010-api-tokens-in-env]]), [[settings]], [[setup]].
