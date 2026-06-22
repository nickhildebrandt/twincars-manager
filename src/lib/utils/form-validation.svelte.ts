import { safeParse, type BaseIssue, type BaseSchema } from 'valibot'

/**
 * Shared form-validation primitive used by every form in the app to
 * standardise the UX:
 *
 * - The Submit / Apply / Save button is **disabled** until every field
 *   passes the schema. The button is gated by `valid`, never by `touched`.
 * - A field's `error` only surfaces after the user has interacted with it
 *   (`touched`). A pristine form does not light up red on first render.
 * - On submit the caller invokes `markAllTouched()` so a never-touched
 *   form that is submitted via Enter highlights every offending field at
 *   once.
 *
 * Server-side Valibot schemas (`src/lib/server/db/validation.ts`) carry
 * the canonical German messages. We re-run the same schema client-side so
 * the user sees the exact wording the server would have produced — and
 * never an English Valibot default.
 *
 * Usage:
 *
 * ```ts
 * const fv = useFormValidation(
 *   schema,
 *   () => ({ firstName, lastName, email })
 * )
 * // fv.errors.firstName       → string | null
 * // fv.touched.firstName      → boolean
 * // fv.valid                  → boolean (no touched gate)
 * // fv.markTouched('email')   → mark a single field touched on blur
 * // fv.markAllTouched()       → mark every field touched (on submit)
 * ```
 *
 * @group internal
 * @module form-validation
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>

/**
 * The shape returned by {@link useFormValidation}. `errors` always carries
 * a key for every field; the value is the curated German message or
 * `null` when valid. `touched` follows the same shape.
 */
export type FormValidationHandle<T extends Record<string, unknown>> = {
  /** True when every field passes the schema. Use this to gate the submit button. */
  readonly valid: boolean
  /** Per-field German error message, or `null` when valid. */
  readonly errors: Readonly<Record<keyof T, string | null>>
  /** Per-field flag — true once the user has interacted with the field. */
  readonly touched: Readonly<Record<keyof T, boolean>>
  /** Mark a single field as touched (call from `onblur`). */
  markTouched: (field: keyof T) => void
  /** Mark every field as touched at once (call from the submit handler). */
  markAllTouched: () => void
  /** Reset every touched flag — useful after a successful save. */
  resetTouched: () => void
}

/**
 * Build a reactive validation handle for a form. Pass the Valibot schema
 * that mirrors the server-side validator and a thunk returning the
 * current values; the returned object reacts to every change.
 *
 * The schema MUST be an object schema (`v.object({ ... })`) — that's the
 * only shape that lets us extract per-field issues from `safeParse`.
 *
 * The thunk pattern (`() => ({ ... })`) is used so the helper depends on
 * the current rune values without us having to thread `$derived` through
 * the call site.
 */
export const useFormValidation = <T extends Record<string, unknown>>(
  schema: AnySchema | (() => AnySchema),
  values: () => T
): FormValidationHandle<T> => {
  const touchedState = $state<Record<string, boolean>>({})

  const resolveSchema = (): AnySchema =>
    typeof schema === 'function' ? schema() : schema

  const result = $derived.by(() => {
    const v = values()
    return safeParse(resolveSchema(), v)
  })

  const errors = $derived.by(() => {
    const v = values()
    const out: Record<string, string | null> = {}
    for (const key of Object.keys(v)) out[key] = null
    out._form = null
    if (result.success) return out as Record<keyof T, string | null>
    for (const issue of result.issues) {
      const path = issue.path
      // Root-level `check()` failures (no path) land under `_form`.
      let key: string
      if (!path || path.length === 0) {
        key = '_form'
      } else {
        const first = path[0]
        key =
          typeof first === 'object' && first !== null && 'key' in first
            ? String((first as { key: unknown }).key)
            : String(first)
      }
      // Only surface the first issue per field — multi-field error walls
      // confuse non-technical users (mirrors handleValidationError).
      if (out[key] == null) {
        const msg = issue.message
        // Drop English Valibot defaults — fall back to a generic German
        // sentence. Heuristic: any message containing an ASCII-only word
        // sequence without German umlauts that starts with "Invalid" /
        // "Expected" is from Valibot's English default.
        if (
          typeof msg === 'string' &&
          msg.length > 0 &&
          !/^(Invalid|Expected|Missing)/.test(msg)
        ) {
          out[key] = msg
        } else {
          out[key] = 'Bitte prüfen Sie Ihre Eingabe.'
        }
      }
    }
    return out as Record<keyof T, string | null>
  })

  const touched = $derived.by(() => {
    const v = values()
    const out: Record<string, boolean> = {}
    for (const key of Object.keys(v)) out[key] = touchedState[key] === true
    return out as Record<keyof T, boolean>
  })

  return {
    get valid() {
      return result.success
    },
    get errors() {
      return errors
    },
    get touched() {
      return touched
    },
    markTouched(field: keyof T) {
      touchedState[String(field)] = true
    },
    markAllTouched() {
      const v = values()
      for (const key of Object.keys(v)) touchedState[key] = true
    },
    resetTouched() {
      for (const key of Object.keys(touchedState)) touchedState[key] = false
    }
  }
}

/**
 * Returns the class string for a form control given the current error /
 * touched state. Centralises the rule "show `input-error` only once the
 * user has interacted with the field AND the field is invalid", so every
 * form flips red consistently.
 *
 * @param error  the current German error message or `null`
 * @param touched whether the field has been touched at least once
 * @param base  the base class (defaults to `input input-bordered w-full`)
 */
export const validationClasses = (
  error: string | null | undefined,
  touched: boolean | undefined,
  base = 'input input-bordered w-full'
): string => {
  const showError = Boolean(error) && touched === true
  return showError ? `${base} input-error` : base
}

/**
 * Same as {@link validationClasses} for `<select>`. DaisyUI uses
 * `select-error` instead of `input-error`.
 */
export const selectValidationClasses = (
  error: string | null | undefined,
  touched: boolean | undefined,
  base = 'select select-bordered w-full'
): string => {
  const showError = Boolean(error) && touched === true
  return showError ? `${base} select-error` : base
}

/**
 * Same as {@link validationClasses} for `<textarea>`. DaisyUI uses
 * `textarea-error`.
 */
export const textareaValidationClasses = (
  error: string | null | undefined,
  touched: boolean | undefined,
  base = 'textarea textarea-bordered w-full'
): string => {
  const showError = Boolean(error) && touched === true
  return showError ? `${base} textarea-error` : base
}
