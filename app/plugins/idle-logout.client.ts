/**
 * Signs out after a period without activity — with a warning, and across all
 * open tabs.
 *
 * The predecessor counted per tab: a tab left open in the background reached
 * the timeout and signed out the session of **every** tab, including the one
 * the user was typing in. There was no warning, so a half-filled form was
 * simply gone (B-013, B-072).
 *
 * Two things fix it. Activity is written to `localStorage`, which every tab of
 * the same origin reads, so any tab's activity keeps all of them alive. And
 * the last two minutes are announced, with a button to stay signed in.
 */
import {
  IDLE_CHANNEL,
  IDLE_STORAGE_KEY,
  IDLE_WARNING_SECONDS,
  formatCountdown,
  idleStateAt,
} from '#shared/idle'

/** Events that count as "somebody is there". */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'visibilitychange'] as const

/** How often the state is judged. A second is precise enough for a countdown. */
const TICK_MS = 1_000

/** Activity is only written this often, so typing does not hammer storage. */
const WRITE_EVERY_MS = 5_000

export default defineNuxtPlugin({
  name: 'idle-logout',
  setup() {
    const timeoutMinutes = Number(useRuntimeConfig().public.idleTimeoutMinutes) || 60
    const state = useAuthState()
    const notify = useNotify()

    let lastWrite = 0
    let warned = false
    let signingOut = false
    let toastId: string | number | undefined

    const now = () => Date.now()

    /** The newest activity any tab reported. */
    function readLastActivity(): number {
      try {
        const stored = Number(localStorage.getItem(IDLE_STORAGE_KEY))
        return Number.isFinite(stored) && stored > 0 ? stored : now()
      }
      catch {
        // Private window, blocked storage: fall back to this tab alone.
        return now()
      }
    }

    function writeActivity(at: number): void {
      try {
        localStorage.setItem(IDLE_STORAGE_KEY, String(at))
      }
      catch {
        // Nothing to do. The tab still counts its own activity below.
      }
    }

    const channel = typeof BroadcastChannel === 'undefined'
      ? undefined
      : new BroadcastChannel(IDLE_CHANNEL)

    function noteActivity(): void {
      if (signingOut) return
      const at = now()
      if (at - lastWrite < WRITE_EVERY_MS) return
      lastWrite = at
      writeActivity(at)
      if (warned) {
        warned = false
        if (toastId !== undefined) useToast().remove(toastId)
        toastId = undefined
      }
    }

    /** Called by this tab and, through the channel, by every other one. */
    async function signOutIdle(broadcast: boolean): Promise<void> {
      if (signingOut) return
      signingOut = true
      if (broadcast) channel?.postMessage('signed-out')
      // navigateTo rather than a hard reload: a page that warns about unsaved
      // input can still do so, and the predecessor's deadlock — the unload
      // prompt blocking a sign-out that had already happened — cannot occur.
      await useAuth().signOut('idle')
    }

    function tick(): void {
      if (signingOut || !state.value.user) return

      const idle = idleStateAt(readLastActivity(), now(), timeoutMinutes)

      if (idle.phase === 'expired') {
        void signOutIdle(true)
        return
      }

      if (idle.phase === 'warning' && !warned) {
        warned = true
        toastId = notify.warning('Sie werden gleich abgemeldet.', {
          description: `Noch ${formatCountdown(idle.remainingSeconds)} Minuten. `
            + 'Eine Eingabe oder ein Klick genügt, um angemeldet zu bleiben.',
          duration: IDLE_WARNING_SECONDS * 1_000,
        })?.id
      }
    }

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, noteActivity, { passive: true })
    }
    channel?.addEventListener('message', (event) => {
      if (event.data === 'signed-out') void signOutIdle(false)
    })

    writeActivity(now())
    const timer = window.setInterval(tick, TICK_MS)

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        window.clearInterval(timer)
        channel?.close()
      })
    }
  },
})
