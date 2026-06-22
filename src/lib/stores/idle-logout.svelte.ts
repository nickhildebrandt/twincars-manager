/**
 * Client-side idle-logout helper.
 *
 * Tracks user activity (`mousemove`, `keydown`, `click`, `scroll`,
 * `touchstart`) on the document and signs the user out after a
 * configurable idle window. Default: 60 minutes (per user spec).
 *
 * Why client-side: better-auth's session lifetime is independent
 * (7 days; refreshes on activity through `auth.api.getSession`). The
 * security-meaningful timeout is the server session; this helper is
 * a UX guarantee that a forgotten browser doesn't sit logged in on a
 * shared workshop screen.
 *
 * Pattern:
 *
 * ```ts
 * import { startIdleLogout } from '$lib/stores/idle-logout.svelte'
 *
 * $effect(() => startIdleLogout({
 *   timeoutMs: 60 * 60 * 1000,
 *   onLogout: async () => {
 *     await authClient.signOut()
 *     await goto('/login?reason=idle', { invalidateAll: true })
 *   }
 * }))
 * ```
 *
 * The returned cleanup function removes the listeners. Calling
 * `startIdleLogout` again replaces the previous timer.
 */
type IdleConfig = {
  timeoutMs: number
  onLogout: () => void | Promise<void>
  /**
   * Events that reset the idle timer. Defaults to a sensible set; the
   * caller may narrow if a specific surface should *not* count as
   * activity (e.g. an embedded video player).
   */
  events?: ReadonlyArray<keyof DocumentEventMap>
}

const DEFAULT_EVENTS = [
  'mousemove',
  'keydown',
  'click',
  'scroll',
  'touchstart'
] as const

export function startIdleLogout(config: IdleConfig): () => void {
  if (typeof window === 'undefined') return () => {}

  const events = (config.events ?? DEFAULT_EVENTS) as ReadonlyArray<string>
  let timer: ReturnType<typeof setTimeout> | null = null
  let firing = false

  const scheduleLogout = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (firing) return
      firing = true
      // Best-effort — swallow sync throws AND async rejections so an
      // offline /api/auth doesn't strand the user on an unresponsive
      // page.
      try {
        Promise.resolve(config.onLogout()).catch(() => undefined)
      } catch {
        /* swallowed */
      }
    }, config.timeoutMs)
  }

  const reset = () => {
    if (firing) return
    scheduleLogout()
  }

  for (const ev of events) {
    document.addEventListener(ev, reset, { passive: true })
  }
  scheduleLogout()

  return () => {
    if (timer) clearTimeout(timer)
    for (const ev of events) {
      document.removeEventListener(ev, reset)
    }
  }
}
