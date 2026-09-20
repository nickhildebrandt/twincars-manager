/**
 * When a session has been idle long enough to end it.
 *
 * The predecessor counted per browser tab and without warning: a tab left open
 * in the background signed the user out while they were working in another
 * one, and a half-filled form was simply gone (B-013, B-072). The counting is
 * therefore pure and shared here; the plugin around it feeds it the last
 * activity of **all** tabs.
 */

/** How long before the end the warning appears. */
export const IDLE_WARNING_SECONDS = 120

export type IdlePhase = 'active' | 'warning' | 'expired'

export type IdleState = {
  phase: IdlePhase
  /** Seconds until the session ends. Zero once it has. */
  remainingSeconds: number
}

/**
 * Judges one moment.
 *
 * `lastActivity` and `now` are milliseconds. A last activity in the future —
 * two tabs whose clocks disagree, or a stored value somebody edited — counts
 * as "just now" rather than as a reason to sign somebody out.
 */
export function idleStateAt(
  lastActivity: number,
  now: number,
  timeoutMinutes: number,
  warningSeconds: number = IDLE_WARNING_SECONDS,
): IdleState {
  const timeoutMs = timeoutMinutes * 60_000
  const idleMs = Math.max(0, now - lastActivity)
  const remainingMs = timeoutMs - idleMs

  if (remainingMs <= 0) return { phase: 'expired', remainingSeconds: 0 }

  const remainingSeconds = Math.ceil(remainingMs / 1000)
  return {
    phase: remainingSeconds <= warningSeconds ? 'warning' : 'active',
    remainingSeconds,
  }
}

/** `1:59` — the countdown in the warning. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`
}

/** The key both the storage and the channel use, so tabs find each other. */
export const IDLE_STORAGE_KEY = 'tcm:last-activity'
export const IDLE_CHANNEL = 'tcm:idle'
