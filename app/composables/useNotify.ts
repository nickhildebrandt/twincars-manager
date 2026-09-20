/**
 * The only way to show a toast.
 *
 * Every mutation reports itself — success as well as failure. Wording, colour
 * and duration are decided here so they cannot drift apart across modules
 * (../../docs/rewrite/04-ux.md §3.1).
 */
export type NotifyOptions = {
  /** Extra line under the headline, e.g. the reason a save failed. */
  description?: string
  /** Overrides the default duration in milliseconds. `0` keeps it open. */
  duration?: number
}

export const NOTIFY_DURATION = {
  success: 4_500,
  info: 4_500,
  warning: 6_000,
  error: 8_000,
} as const

/**
 * Wie dringend eine Meldung vorgelesen wird.
 *
 * `foreground` unterbricht den Screenreader, `background` wartet auf eine
 * Pause. Ein Fehler muss unterbrechen, eine gespeicherte Änderung nicht — der
 * Vorgänger las alles höflich vor, auch Fehler (B-035).
 */
const POLITENESS = {
  success: 'background',
  info: 'background',
  warning: 'foreground',
  error: 'foreground',
} as const

export function useNotify() {
  const toast = useToast()

  const add = (
    color: 'success' | 'info' | 'warning' | 'error',
    title: string,
    options?: NotifyOptions,
  ) =>
    toast.add({
      title,
      description: options?.description,
      color,
      duration: options?.duration ?? NOTIFY_DURATION[color],
      icon: ICONS[color],
      type: POLITENESS[color],
    })

  return {
    /** A change was saved. */
    success: (title: string, options?: NotifyOptions) => add('success', title, options),
    /** Something worth knowing, without a problem. */
    info: (title: string, options?: NotifyOptions) => add('info', title, options),
    /** Partly succeeded, e.g. three of twelve recipients failed. */
    warning: (title: string, options?: NotifyOptions) => add('warning', title, options),
    /**
     * A change failed. Longer on screen than a success, because the user has
     * to read and act on it.
     */
    error: (title: string, options?: NotifyOptions) => add('error', title, options),
    /** Removes everything currently on screen. */
    clear: () => toast.clear(),
  }
}

const ICONS = {
  success: 'i-lucide-check',
  info: 'i-lucide-info',
  warning: 'i-lucide-triangle-alert',
  error: 'i-lucide-circle-alert',
} as const
