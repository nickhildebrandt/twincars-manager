/**
 * Stack-based "create in a full page, then come back" flow.
 *
 * When a picker offers "Neu anlegen", the host form pushes a frame
 * (which entity is being created, where to come back to, which picker
 * field started it, and a serializable draft of everything the user
 * had typed) and navigates to the entity's regular creation page.
 * That page — the flow *leaf* — calls {@link finish} after a
 * successful save (or {@link cancel} on abort) and navigates back to
 * the frame's `returnUrl`. On mount the origin form consumes the
 * pending return via {@link pendingReturnFor}, restores its draft and
 * auto-selects the created entity in the originating picker.
 *
 * Chains nest (Auftrag -> Fahrzeug -> Kunde): each hop pushes another
 * frame. Cycles are forbidden — hosts hide "Neu anlegen" for every
 * entity type already reported by {@link activeEntities}.
 *
 * Drafts never touch the database. The stack and the pending return
 * are mirrored into `sessionStorage` (guarded for SSR) so full page
 * loads survive; storage failures (quota, disabled) degrade to the
 * in-memory state, which is enough for SPA navigation.
 */

/** Entity types that support the full-page creation flow. */
export type CreationFlowEntity = 'customer' | 'vehicle' | 'employee'

/**
 * Prefill values the host hands to the leaf page so related pickers
 * start preselected. Today's only use: a host that already picked a
 * customer starts a VEHICLE creation — the leaf preselects that
 * customer as the holder instead of opening with an empty picker.
 */
export type CreationFlowLeafInitial = {
  customerId?: string
  customerLabel?: string
}

/** One level of the flow: "somebody at `returnUrl` is waiting for a new `entity`". */
export type CreationFlowFrame = {
  entity: CreationFlowEntity
  /** Path (+ search) of the origin page the leaf returns to. */
  returnUrl: string
  /** Which picker field of the origin form started the flow (e.g. 'customerId'). */
  originField: string
  /** JSON-serializable snapshot of the origin form's entire state. */
  draft: unknown
  /** Epoch ms; stale flows are dropped on load. */
  createdAt: number
  /** Optional prefill the leaf consumes (see {@link CreationFlowLeafInitial}). */
  leafInitial?: CreationFlowLeafInitial
}

/** Created entity handed back to the originating picker. */
export type CreationFlowResult = {
  id: string
  label: string
  /**
   * Holder of a created vehicle (customer id + picker label), `null`
   * for holderless creations. Hosts re-sync their customer picker to
   * this when it differs from their current selection — the same rule
   * as picking an existing vehicle, which always wins over a
   * previously chosen customer.
   */
  holder?: { id: string; label: string } | null
}

/** Popped frame plus outcome, waiting to be consumed by the origin form. */
export type CreationFlowReturn = {
  returnUrl: string
  originField: string
  draft: unknown
  /** `null` when the user cancelled on the creation page. */
  result: CreationFlowResult | null
}

const STORAGE_KEY = 'twincars.creation-flow'

/** A flow untouched for an hour is considered abandoned. */
const MAX_AGE_MS = 60 * 60 * 1000

type PersistedState = {
  stack: CreationFlowFrame[]
  pending: CreationFlowReturn | null
}

/**
 * Current page URL (path + search) as used for `returnUrl` matching.
 * Hosts capture it at {@link CreationFlowStore.start} time and the
 * same expression is passed to `pendingReturnFor` on mount, so the
 * two sides always agree byte for byte. Empty string during SSR.
 */
export const currentUrl = (): string =>
  typeof window === 'undefined'
    ? ''
    : window.location.pathname + window.location.search

/**
 * Exported for unit tests (fresh instances against a prepared
 * sessionStorage). Application code uses the {@link creationFlow}
 * singleton.
 */
export class CreationFlowStore {
  #stack = $state<CreationFlowFrame[]>([])
  #pending = $state<CreationFlowReturn | null>(null)

  constructor() {
    this.#load()
  }

  /** Topmost frame — leaf pages check `top?.entity` to detect flow mode. */
  get top(): CreationFlowFrame | null {
    return this.#stack.at(-1) ?? null
  }

  /** Number of frames on the stack. */
  get depth(): number {
    return this.#stack.length
  }

  /** Push a new frame (host form is about to navigate to the leaf). */
  start(frame: CreationFlowFrame): void {
    this.#stack = [...this.#stack, frame]
    this.#persist()
  }

  /**
   * Successful create on the leaf: pops the top frame and stores the
   * pending return for the origin form. Returns the `returnUrl` the
   * leaf must navigate to, or `null` when no flow was active.
   */
  finish(result: CreationFlowResult): string | null {
    return this.#pop(result)
  }

  /**
   * Cancelled create on the leaf: same as {@link finish} but with a
   * `null` result — the origin form only restores its draft.
   */
  cancel(): string | null {
    return this.#pop(null)
  }

  /**
   * Consume the pending return if it belongs to `url`. A mismatching
   * URL leaves the pending return untouched (the user may have
   * navigated elsewhere in between); a match clears it, so the draft
   * is restored exactly once.
   */
  pendingReturnFor(url: string): CreationFlowReturn | null {
    const pending = this.#pending
    if (!pending || pending.returnUrl !== url) return null
    this.#pending = null
    this.#persist()
    return pending
  }

  /**
   * Entity types currently being created somewhere in the chain.
   * Hosts hide "Neu anlegen" for these types (cycle guard).
   */
  activeEntities(): Set<CreationFlowEntity> {
    return new Set(this.#stack.map((f) => f.entity))
  }

  /** Drop the whole flow (stack + pending return). */
  reset(): void {
    this.#stack = []
    this.#pending = null
    this.#persist()
  }

  #pop(result: CreationFlowResult | null): string | null {
    const frame = this.#stack.at(-1)
    if (!frame) return null
    this.#stack = this.#stack.slice(0, -1)
    this.#pending = {
      returnUrl: frame.returnUrl,
      originField: frame.originField,
      draft: frame.draft,
      result
    }
    this.#persist()
    return frame.returnUrl
  }

  #load(): void {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as PersistedState
      if (!Array.isArray(parsed.stack)) return
      // A flow whose newest frame is older than MAX_AGE_MS was
      // abandoned — drop it entirely (frames of one chain belong
      // together, pruning single levels would corrupt the chain).
      const newest = parsed.stack.at(-1)
      if (newest && Date.now() - newest.createdAt > MAX_AGE_MS) return
      this.#stack = parsed.stack
      this.#pending = parsed.pending ?? null
    } catch {
      // Corrupt or inaccessible storage — start clean.
    }
  }

  #persist(): void {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          stack: this.#stack,
          pending: this.#pending
        } satisfies PersistedState)
      )
    } catch {
      // Quota exceeded (e.g. photo-heavy drafts) or storage disabled —
      // the in-memory state still covers SPA navigation.
    }
  }
}

/** Singleton flow state shared by all host forms and leaf pages. */
export const creationFlow = new CreationFlowStore()
