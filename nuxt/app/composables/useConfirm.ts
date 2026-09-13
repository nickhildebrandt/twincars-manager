/**
 * Bestätigen, als Frage mit Antwort.
 *
 *   if (!await confirm({ title: 'Kunde löschen?', ... })) return
 *
 * Der Vorgänger hatte neun Stellen mit selbstgebauten Dialogen, von denen nur
 * drei den Fokus fingen und auf Escape reagierten (B-108). Hier gibt es einen,
 * er kommt aus Nuxt UI, und er liefert ein Versprechen statt eines Rückrufs —
 * damit steht der Abbruch im Code dort, wo die Handlung steht.
 */
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'

export type ConfirmOptions = {
  title: string
  /** Was passiert, in einem vollständigen Satz. */
  description?: string
  /** Beschriftung der bestätigenden Schaltfläche. */
  confirmLabel?: string
  cancelLabel?: string
  /** `error` für alles Unwiderrufliche, sonst `primary`. */
  tone?: 'primary' | 'error'
  /** Zusätzliche Zeilen, z. B. die Aufzählung dessen, was mitgelöscht wird. */
  details?: string[]
}

export function useConfirm() {
  const overlay = useOverlay()

  /** Öffnet den Dialog und wartet auf die Antwort. `false` heißt abbrechen. */
  return async function confirm(options: ConfirmOptions): Promise<boolean> {
    const modal = overlay.create(ConfirmDialog, {
      props: {
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? 'Bestätigen',
        cancelLabel: options.cancelLabel ?? 'Abbrechen',
        tone: options.tone ?? 'primary',
        details: options.details ?? [],
      },
    })
    return await modal.open().result === true
  }
}
