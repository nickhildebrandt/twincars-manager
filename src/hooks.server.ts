import type {
  Handle,
  HandleServerError,
  HandleValidationError
} from '@sveltejs/kit'
import { seedDefaults } from '$lib/server/db/seed-defaults'
import {
  autoGeneratePayrollEntries,
  autoSendPayrollEmails
} from '$lib/server/services/payroll-service'

/**
 * Schema migrations are NOT run here. Production runs `node
 * scripts/migrate.js` once before the server boots (see
 * `Dockerfile` CMD) — by the time the SvelteKit handler accepts a
 * request, the database is already at the target schema.
 *
 * What stays at runtime is `seedDefaults()`: an idempotent insert of
 * default rows (mail templates, ledger categories, number ranges)
 * that is content, not schema. Running it on the first request keeps
 * dev `npm run dev` self-contained without forcing a separate seed
 * step in the dev workflow. In production it's a no-op after the
 * first hit.
 */
let seeded = false
let seedPromise: Promise<void> | null = null

const ensureSeeded = () => {
  if (seeded) return Promise.resolve()
  if (!seedPromise) {
    seedPromise = (async () => {
      await seedDefaults()
      seeded = true
    })()
  }
  return seedPromise
}

/**
 * In-Process Tages-Scheduler für die Auto-Lohnabrechnung. Beim ersten
 * Request nach Server-Start wird ein `setInterval` aufgesetzt, der
 * einmal alle 6 Stunden `autoGeneratePayrollEntries()` und danach
 * `autoSendPayrollEmails()` ausführt. Beide Funktionen sind
 * idempotent — die häufige Frequenz schützt nur vor langen Stillen
 * (z.B. Container-Restart kurz nach dem Stichtag).
 *
 * Bei einem Multi-Replica-Deployment würde das mehrfach laufen; das
 * Setup ist explizit Single-Container (siehe CONTRIBUTING §17), daher
 * ist die Race weder real noch problematisch.
 */
let payrollSchedulerStarted = false
const sixHoursMs = 6 * 60 * 60 * 1000
const startPayrollScheduler = () => {
  if (payrollSchedulerStarted) return
  payrollSchedulerStarted = true
  const tick = async () => {
    try {
      await autoGeneratePayrollEntries()
      await autoSendPayrollEmails()
    } catch (err) {
      console.error('[payroll-scheduler]', err)
    }
  }
  // Erste Ausführung kurz nach Boot (nicht blockierend), dann
  // regelmäßig.
  setTimeout(tick, 30_000).unref?.()
  setInterval(tick, sixHoursMs).unref?.()
}

export const handle: Handle = async ({ event, resolve }) => {
  await ensureSeeded()
  startPayrollScheduler()
  return resolve(event)
}

/**
 * Convert a Valibot validation failure into a single user-safe German
 * message. The shape returned here lands in `App.Error` and is consumed
 * by `+error.svelte` and `handleClientError` — so the message is the
 * only thing the user ever sees.
 *
 * Notes:
 * - Only the first issue is surfaced. Showing all issues at once is
 *   noisy and confusing for non-technical users.
 * - The path is rendered as `„field.subField"` so the user sees which
 *   input caused the problem.
 * - If the underlying schema didn't supply a German message (Valibot's
 *   built-in defaults are English), we fall back to a generic German
 *   sentence rather than leaking the English text.
 */
export const handleValidationError: HandleValidationError = ({ issues }) => {
  const first = issues[0]
  const path =
    first && 'path' in first && Array.isArray(first.path) && first.path.length
      ? first.path
          .map((p: unknown) =>
            typeof p === 'object' && p !== null && 'key' in p
              ? String((p as { key: unknown }).key)
              : String(p)
          )
          .join('.')
      : null
  const raw = first?.message?.trim() ?? ''
  // Heuristic: Valibot's built-in messages are English ASCII without
  // umlauts. If we haven't given the schema a curated German message,
  // fall back to a generic sentence instead of leaking English to the
  // user.
  const looksGerman = /[äöüÄÖÜß]/.test(raw) || raw === ''
  const detail = looksGerman && raw ? raw : 'Bitte prüfen Sie Ihre Eingabe.'
  return {
    message: path
      ? `Ungültige Eingabe für „${path}“: ${detail}`
      : `Ungültige Eingabe: ${detail}`
  }
}

/**
 * Translate any unhandled server error into a user-safe German message.
 *
 * Three buckets:
 * - 5xx: log the original (stack, SQL, etc.) for ops; return a generic
 *   German sentence — never leak internals to the browser.
 * - 4xx that we explicitly threw (`error(404, 'Kunde nicht gefunden.')`,
 *   etc.): SvelteKit already passes the message through; we don't
 *   override it. Returning `undefined` lets the original message stand.
 * - Unknown 4xx without a message: provide a German fallback.
 */
export const handleError: HandleServerError = ({ error, status, message }) => {
  if (status >= 500) {
    console.error('[server-error]', error)
    return { message: 'Ein interner Fehler ist aufgetreten.' }
  }
  // Curated 4xx (`error(404, '…')`) already supplies a German message —
  // let SvelteKit forward it untouched.
  if (typeof message === 'string' && message.trim().length > 0) {
    return undefined
  }
  return { message: 'Die Anfrage konnte nicht bearbeitet werden.' }
}
