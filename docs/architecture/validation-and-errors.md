---
title: Validation and error handling
tags: [architecture, validation, valibot, errors]
updated: 2026-07-07
---

# Validation and error handling

Two invariants (CONTRIBUTING §12): the user always sees a clear **German**
sentence, and never sees anything private (stacks, SQL, paths).

## Valibot (server-side)

- Every remote function validates its argument with Valibot; never
  `'unchecked'` for exposed queries/commands.
- Reusable schemas in `src/lib/server/db/validation.ts`: `emailSchema`,
  `ibanSchema`, `moneySchema`, `dateStringSchema`, `zipSchema`,
  `phoneSchema`, `idSchema`, `paymentMethodSchema` (picklist over
  `src/lib/payment-methods.ts`: Überweisung | Bar | Lastschrift | Karte),
  document type picklists, etc. Reach for these before writing new ones.
- Global column validators added 2026-07: `licensePlateSchema`
  (uppercased, max 12 chars, `A-ZÄÖÜ0-9 -`), `vinSchema` (exactly 17
  chars, ISO 3779, no I/O/Q, uppercased), `hsnSchema` (4 digits),
  `tsnSchema` (3 alphanumerics, uppercased), `timeHHMMSchema` (24-hour
  HH:MM) and `personnelNumberSchema` (non-empty, max 20 chars).
- **IBAN / BIC are checksum-validated** (QA round 1): the shared
  helpers in `src/lib/utils/iban.ts` implement the ISO 13616 **mod-97**
  IBAN check (iterative remainder, overflow-safe) and the ISO 9362 BIC
  shape (8 or 11 chars). Shared client/server: `ibanSchema` /
  `bicSchema` in `validation.ts` call `isValidIban` / `isValidBic`, and
  forms can reuse the same functions for click-time feedback. Wired
  into the setup wizard and the customer/supplier/employee remotes.
- Every pipe step needs a German message; realistic numeric bounds so
  hostile payloads cannot overflow Postgres ints into 500s. Cross-field
  rules use a Valibot `check` on the object schema (example: workshop
  hours enforce `opensAt < closesAt` on open days, [[settings]]).

## Server funnels (`src/hooks.server.ts`)

- `handleValidationError`: surfaces only the FIRST issue as
  `Ungültige Eingabe für „<field>": <reason>`. Heuristic: if the message
  contains no umlauts it is assumed to be an English Valibot default and
  replaced with "Bitte prüfen Sie Ihre Eingabe."
- **`FIELD_LABELS`** (exported from `hooks.server.ts`, roughly 100
  entries): `handleValidationError` renders the offending field key
  through this German label map, so users see "IBAN" instead of
  `bankIban`. An array index in the issue path becomes "(Position N)",
  e.g. `items.0.quantity` renders as "Menge (Position 1)". Unknown keys
  fall back to the raw key. **When you introduce a new schema field
  key, add its German label to the map.**
- `handleError`: 5xx → log original, return "Ein interner Fehler ist
  aufgetreten."; curated 4xx (`error(404, 'Kunde nicht gefunden.')`)
  passes through untouched; message-less 4xx → "Die Anfrage konnte nicht
  bearbeitet werden."
- Inside remotes, curated failures use SvelteKit's
  `error(status, 'german message')`.

## Client side

- Every page/form catch goes through `handleClientError(err, baseMessage?)`
  from `src/lib/utils/client-error.ts`: toast shows only curated German
  (anything else collapses to "Es ist leider ein Fehler aufgetreten.");
  the raw error goes to `console.error('[client-error]', ...)` only.
- **Click-time form validation, never disabled buttons**: action
  buttons are disabled only by `busy.active` (or a true mode gate),
  never by validation state. On submit, `useFormValidation` from
  `src/lib/utils/form-validation.svelte.ts` marks all fields touched
  and renders a German error summary plus per-field errors; forms carry
  `novalidate` so browser bubbles never appear (CONTRIBUTING §11).
- Single-toast store `$lib/stores/toast.svelte` - one toast at a time.
- Root `src/routes/+error.svelte` renders thrown route errors with
  status-aware German copy and "Zurück" / "Zum Dashboard" actions.

## Canonical wording

| Situation              | Wording                                     |
| ---------------------- | ------------------------------------------- |
| Generic toast fallback | Es ist leider ein Fehler aufgetreten.       |
| 5xx                    | Ein interner Fehler ist aufgetreten.        |
| Unknown 4xx            | Die Anfrage konnte nicht bearbeitet werden. |
| Not found              | `<Entity> nicht gefunden.`                  |
| Mutation context       | `<Entity> konnte nicht <verb> werden`       |

Forbidden: showing `error.message` raw, `alert(e)`, silent `catch {}`,
English Valibot defaults in production schemas, per-page custom error
boxes.

Related: [[remote-functions]], [[loading-and-busy]].
