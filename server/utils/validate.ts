/**
 * The only way to read input in this application.
 *
 * Body, query, route parameters and headers all go through these helpers, so
 * the error shape is produced in exactly one place
 * (../../docs/rewrite/03-architektur.md §6.2).
 *
 * Why not h3's own `readValidatedBody`? Because the h3 version shipped with
 * Nuxt 4.5 expects a plain `(data) => T` function and does not recognise a
 * Standard Schema — handing it a Valibot schema simply does not work. And the
 * 422 payload must be built here regardless, not by whatever h3 does next.
 */
import * as v from 'valibot'
import { getQuery, getRequestHeader, getRouterParams, readBody } from 'h3'
import type { H3Event } from 'h3'
import { labelForPath } from '#shared/schemas/field-labels'
import { badRequest, validationFailed } from './errors.ts'
import '#shared/schemas/messages'

type Schema = v.GenericSchema | v.GenericSchemaAsync

/**
 * Turns Valibot issues into `path → German message`.
 *
 * Only the first issue per field survives: a wall of messages on one input
 * helps nobody, and the remaining ones reappear after the first is fixed.
 */
export function toFieldErrors(issues: readonly v.BaseIssue<unknown>[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of issues) {
    const path = v.getDotPath(issue) ?? ''
    if (path in fields) continue
    fields[path] = issue.message
  }
  return fields
}

/** First field error as a sentence, for a toast or a log line. */
export function firstFieldMessage(fields: Record<string, string>): string {
  const [path, message] = Object.entries(fields)[0] ?? []
  if (!path) return 'Bitte prüfen Sie Ihre Eingaben.'
  return `Ungültige Eingabe für „${labelForPath(path)}“: ${message}`
}

async function parse<T extends Schema>(schema: T, input: unknown): Promise<v.InferOutput<T>> {
  const result = await v.safeParseAsync(schema as v.GenericSchemaAsync, input)
  if (result.success) return result.output as v.InferOutput<T>
  throw validationFailed(toFieldErrors(result.issues))
}

/** Validated request body. */
export async function useValidatedBody<T extends Schema>(
  event: H3Event,
  schema: T,
): Promise<v.InferOutput<T>> {
  let body: unknown
  try {
    body = await readBody(event)
  }
  catch {
    throw badRequest('Die Anfrage enthielt keine lesbaren Daten.')
  }
  return parse(schema, body)
}

/**
 * Validated query string.
 *
 * Query values always arrive as strings, so numbers and booleans are coerced
 * before parsing — otherwise every list schema would need its own conversion.
 */
export async function useValidatedQuery<T extends Schema>(
  event: H3Event,
  schema: T,
): Promise<v.InferOutput<T>> {
  return parse(schema, coerceQuery(getQuery(event)))
}

/** Validated route parameters, e.g. `{ id: uuidSchema }`. */
export async function useValidatedParams<T extends Schema>(
  event: H3Event,
  schema: T,
): Promise<v.InferOutput<T>> {
  return parse(schema, getRouterParams(event, { decode: true }))
}

/** Validated single header, e.g. the bearer token. */
export async function useValidatedHeader<T extends Schema>(
  event: H3Event,
  name: string,
  schema: T,
): Promise<v.InferOutput<T>> {
  return parse(schema, getRequestHeader(event, name))
}

/**
 * `?page=2&archived=true` → `{ page: 2, archived: true }`.
 *
 * Only unambiguous cases are converted: a numeric string becomes a number, the
 * words `true` and `false` become booleans, an empty value disappears. Anything
 * else stays a string and is judged by the schema.
 */
export function coerceQuery(query: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(query)) {
    const value = Array.isArray(raw) ? raw.at(-1) : raw
    if (value === '' || value === undefined || value === null) continue
    if (typeof value !== 'string') {
      out[key] = value
      continue
    }
    if (value === 'true') out[key] = true
    else if (value === 'false') out[key] = false
    else if (/^-?\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value))) {
      out[key] = Number(value)
    }
    else out[key] = value
  }
  return out
}

/**
 * Schaut in den Rumpf, ohne die Anfrage scheitern zu lassen.
 *
 * Für den einen Fall, in dem ein Wert gebraucht wird, **bevor** der Endpoint
 * ihn regulär prüft: die Anmeldedrossel muss wissen, auf welches Konto gezielt
 * wird, darf aber nicht selbst über die Gültigkeit entscheiden — das tut die
 * Anmeldung gleich danach, und ihre Antwort ist die, die der Nutzer sehen soll.
 *
 * Gibt `undefined` zurück, wenn nichts Brauchbares darin steht. Wirft nie.
 */
export async function peekValidatedBody<T extends Schema>(
  event: H3Event,
  schema: T,
): Promise<v.InferOutput<T> | undefined> {
  try {
    const result = await v.safeParseAsync(schema as v.GenericSchemaAsync, await readBody(event))
    return result.success ? (result.output as v.InferOutput<T>) : undefined
  }
  catch {
    return undefined
  }
}
