import { nanoid } from 'nanoid'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export type Toast = {
  id: string
  variant: ToastVariant
  message: string
  timeout: number
  createdAt: number
}

/**
 * Global toast state — only one toast is visible at a time.
 * A new toast replaces the previous one immediately, so users always see the
 * latest message instead of a stack of overlapping notifications.
 *
 * The toast auto-dismisses after `timeout` ms; calling `push` again before
 * timeout cancels the pending dismissal.
 */
function createToastStore() {
  let current = $state<Toast | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  const dismiss = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    current = null
  }

  const push = (
    message: string,
    variant: ToastVariant = 'info',
    timeout = 4500
  ) => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const t: Toast = {
      id: nanoid(8),
      variant,
      message,
      timeout,
      createdAt: Date.now()
    }
    current = t
    if (timeout > 0 && typeof window !== 'undefined') {
      timer = setTimeout(() => {
        if (current?.id === t.id) current = null
        timer = null
      }, timeout)
    }
    return t.id
  }

  return {
    get current() {
      return current
    },
    push,
    success: (msg: string) => push(msg, 'success'),
    error: (msg: string) => push(msg, 'error', 6000),
    warning: (msg: string) => push(msg, 'warning'),
    info: (msg: string) => push(msg, 'info'),
    dismiss
  }
}

export const toast = createToastStore()
