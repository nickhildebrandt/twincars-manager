/**
 * Global busy / loading state.
 *
 * Counting semaphore: every concurrent operation increments `count` while it
 * runs and decrements when it finishes. The UI is "busy" whenever `count > 0`.
 *
 * The {@link AppShell} reads {@link busy.active} and renders a full-area
 * loader overlay over the main content slot, locking the UI so the user
 * cannot trigger a second action while one is in flight. The outer chrome
 * (sidebar, header) stays interactive on purpose.
 *
 * Use {@link busy.run} as the canonical wrapper around mutations and any
 * other transition that should block the UI:
 *
 * ```ts
 * await busy.run(() => deleteCustomerRemote({ id }).updates(listCustomersRemote))
 * ```
 *
 * Page navigation is wired to this store from `+layout.svelte` via
 * `beforeNavigate` / `afterNavigate`, so navigation between detail records
 * also flips the overlay automatically — no per-page boilerplate needed.
 */
class BusyStore {
  /** Number of in-flight operations. */
  #count = $state(0)

  /** True while at least one operation is running. */
  get active(): boolean {
    return this.#count > 0
  }

  /** Begin a manual busy section. Always pair with {@link end}. */
  begin(): void {
    this.#count += 1
  }

  /** End a manual busy section started with {@link begin}. */
  end(): void {
    if (this.#count > 0) this.#count -= 1
  }

  /**
   * Run an async operation while the UI is busy. Resolves with the
   * operation's result or rethrows its error — the busy flag is always
   * cleared, even on failure.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    this.begin()
    try {
      return await fn()
    } finally {
      this.end()
    }
  }
}

/** Singleton busy state. Import as `busy` and use `busy.run(...)`. */
export const busy = new BusyStore()
