/**
 * Global busy / loading state for the whole app.
 *
 * Tiered UX:
 *
 * - {@link active} flips on as soon as anything is in flight. The
 *   {@link AppShell} renders a thin top progress bar driven off this flag
 *   — the user sees instant feedback (~16 ms) without having the rest of
 *   the screen interrupted.
 *
 * - {@link slow} flips on only after a 250 ms delay. The same `AppShell`
 *   then mounts a full-area `Loader variant="overlay"` over the main
 *   content slot and marks it `inert`. Anything that finishes inside the
 *   250 ms window — which is most CRUD calls against a local DB — never
 *   shows the overlay at all. No flicker, no flash.
 *
 * Counting semaphore: every concurrent operation increments and decrements
 * its own slot, so independent calls compose cleanly. The store exposes
 * `begin()` returning an end-callback and `run(fn)` for async wrappers:
 *
 * ```ts
 * await busy.run(() => deleteCustomerRemote({ id }).updates(...))
 * ```
 *
 * Page navigation is wired centrally in `+layout.svelte` via
 * `beforeNavigate` / `afterNavigate`, so navigation between detail records
 * also hits this store automatically.
 */
class BusyStore {
  /** Active operations (drives the top progress bar). */
  #count = $state(0)

  /** Operations that have crossed the 250 ms threshold (drives overlay). */
  #slowCount = $state(0)

  /** Threshold (ms) below which only the top bar shows, not the overlay. */
  static readonly SLOW_AFTER_MS = 250

  /** True while at least one operation is running. */
  get active(): boolean {
    return this.#count > 0
  }

  /** True while at least one operation has been running for ≥ 250 ms. */
  get slow(): boolean {
    return this.#slowCount > 0
  }

  /**
   * Begin tracking an operation. Returns the function to call when it ends.
   * Use this when begin / end happen at separate event boundaries (e.g.
   * SvelteKit's `beforeNavigate` / `afterNavigate`).
   *
   * For wrapping async functions, prefer {@link run}.
   */
  begin(): () => void {
    this.#count += 1
    let crossedSlow = false
    const slowTimer = setTimeout(() => {
      crossedSlow = true
      this.#slowCount += 1
    }, BusyStore.SLOW_AFTER_MS)
    return () => {
      clearTimeout(slowTimer)
      if (this.#count > 0) this.#count -= 1
      if (crossedSlow && this.#slowCount > 0) this.#slowCount -= 1
    }
  }

  /**
   * Wrap an async operation. Resolves with the operation's result or
   * rethrows its error — the busy flag is always cleared, even on failure.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const end = this.begin()
    try {
      return await fn()
    } finally {
      end()
    }
  }
}

/**
 * Singleton busy state. Read `busy.active` / `busy.slow`, drive operations
 * with `busy.run(...)`.
 */
export const busy = new BusyStore()
