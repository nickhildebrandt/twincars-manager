import { nanoid } from 'nanoid'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export type Toast = {
  id: string
  variant: ToastVariant
  message: string
  timeout: number
}

/**
 * Global toast state. Imported by the AppShell to render a toast tray and
 * by any component that wants to push a notification.
 */
function createToastStore() {
  let toasts = $state<Toast[]>([])

  const dismiss = (id: string) => {
    toasts = toasts.filter((t) => t.id !== id)
  }

  const push = (
    message: string,
    variant: ToastVariant = 'info',
    timeout = 4000
  ) => {
    const id = nanoid(8)
    toasts = [...toasts, { id, message, variant, timeout }]
    if (timeout > 0 && typeof window !== 'undefined') {
      setTimeout(() => dismiss(id), timeout)
    }
    return id
  }

  return {
    get toasts() {
      return toasts
    },
    push,
    success: (msg: string) => push(msg, 'success'),
    error: (msg: string) => push(msg, 'error'),
    warning: (msg: string) => push(msg, 'warning'),
    info: (msg: string) => push(msg, 'info'),
    dismiss
  }
}

export const toast = createToastStore()
