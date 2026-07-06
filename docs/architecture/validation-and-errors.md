---
title: Validation and error handling
tags: [architecture, validation, valibot, errors]
updated: 2026-07-06
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
- Every pipe step needs a German message; realistic numeric bounds so
  hostile payloads cannot overflow Postgres ints into 500s.

## Server funnels (`src/hooks.server.ts`)

- `handleValidationError`: surfaces only the FIRST issue as
  `Ungültige Eingabe für „<field>": <reason>`. Heuristic: if the message
  contains no umlauts it is assumed to be an English Valibot default and
  replaced with "Bitte prüfen Sie Ihre Eingabe."
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
