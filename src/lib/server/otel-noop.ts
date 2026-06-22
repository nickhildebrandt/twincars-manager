/**
 * No-op `@opentelemetry/api` shim.
 *
 * `better-auth` (≥ 1.6) wraps every endpoint dispatch in `withSpan`,
 * which does `const { trace } = await import('@opentelemetry/api')` and
 * then `trace.getTracer(...).startActiveSpan(...)`. When Rollup bundles
 * the real (CJS) `@opentelemetry/api` for the SSR server it can collapse
 * it to a `default`-only namespace, leaving the named `trace` /
 * `SpanStatusCode` exports `undefined` — so `trace.getTracer` throws
 * `Cannot read properties of undefined` on every request in the
 * production container (while dev, with a different module resolution,
 * works). We don't run OpenTelemetry, so we alias `@opentelemetry/api`
 * to this inert shim (see `vite.config.ts`): tracing becomes a no-op,
 * deterministically, with no dependency on the package being present at
 * runtime.
 */

type NoopSpan = {
  setAttribute: () => NoopSpan
  setStatus: () => NoopSpan
  recordException: () => void
  addEvent: () => NoopSpan
  setAttributes: () => NoopSpan
  end: () => void
}

const noopSpan: NoopSpan = {
  setAttribute: () => noopSpan,
  setAttributes: () => noopSpan,
  setStatus: () => noopSpan,
  recordException: () => {},
  addEvent: () => noopSpan,
  end: () => {}
}

const noopTracer = {
  startActiveSpan<T>(
    _name: string,
    arg2: unknown,
    arg3?: unknown,
    arg4?: unknown
  ): T {
    // OTel overloads: (name, fn) | (name, opts, fn) | (name, opts, ctx, fn).
    const fn = [arg4, arg3, arg2].find((a) => typeof a === 'function') as
      | ((span: NoopSpan) => T)
      | undefined
    return fn ? fn(noopSpan) : (undefined as T)
  },
  startSpan: () => noopSpan
}

export const trace = {
  getTracer: () => noopTracer,
  getActiveSpan: () => undefined,
  getSpan: () => undefined,
  setSpan: <T>(ctx: T) => ctx,
  deleteSpan: <T>(ctx: T) => ctx
}

export const context = {
  active: () => ({}),
  with: <T>(_ctx: unknown, fn: () => T): T => fn()
}

export const SpanStatusCode = { UNSET: 0, OK: 1, ERROR: 2 } as const

export const SpanKind = {
  INTERNAL: 0,
  SERVER: 1,
  CLIENT: 2,
  PRODUCER: 3,
  CONSUMER: 4
} as const

export default { trace, context, SpanStatusCode, SpanKind }
