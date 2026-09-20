/**
 * Warnung vor ungespeicherten Änderungen, an einer Stelle für die ganze
 * Anwendung.
 *
 * Der Vorgänger hatte den Wächter in der Hülle und die Markierung in 24
 * Formularen — mit zwei Fehlern, die beide hier nicht auftreten können:
 *
 *   - Nach „Verwerfen" bei einem Browser-Zurück steuerte er das Ziel mit
 *     einer neuen Navigation an. Der Verlauf bekam dadurch einen zusätzlichen
 *     Vorwärtseintrag, statt zurückzugehen (B-038). Hier wird die Navigation
 *     schlicht fortgesetzt, egal wie sie ausgelöst wurde.
 *   - Wurde das Formular nach dem Speichern nicht rechtzeitig als sauber
 *     gemeldet, brach die Abfrage die Weiterleitung ab. Deshalb gibt
 *     {@link useFormDirty} ein `markSaved()` zurück, das **vor** dem
 *     Weiterleiten aufgerufen wird.
 */

/** Der Satz, den die Abfrage zeigt. Überall derselbe. */
export const UNSAVED_QUESTION
  = 'Es gibt ungespeicherte Änderungen. Wollen Sie die Seite wirklich verlassen?'

export function useDirtyState() {
  return useState<boolean>('form-dirty', () => false)
}

/**
 * Meldet ein Formular als geändert oder sauber.
 *
 *   const dirty = useFormDirty()
 *   watch(state, () => dirty.markDirty(), { deep: true })
 *   // beim Speichern, VOR dem Weiterleiten:
 *   dirty.markSaved()
 */
export function useFormDirty() {
  const dirty = useDirtyState()

  /** Fragt nach, wenn es etwas zu verlieren gibt. Sonst still. */
  function confirmLeave(): boolean {
    if (!dirty.value) return true
    if (!import.meta.client) return true
    // Der Browserdialog ist hier richtig: er hält die Navigation zuverlässig
    // an. Ein eigener Dialog könnte das nicht, weil er nicht blockiert.
    return window.confirm(UNSAVED_QUESTION)
  }

  /**
   * Hängt den Wächter an die aktuelle Seite.
   *
   * `onBeforeRouteLeave` deckt die Navigation innerhalb der Anwendung ab,
   * `beforeunload` das Schließen des Tabs und das Neuladen.
   */
  function guard(): void {
    // `false` hält die Navigation an, ohne den Verlauf anzufassen — auch beim
    // Browser-Zurück. Genau das ging beim Vorgänger schief (B-038).
    onBeforeRouteLeave(() => confirmLeave())

    if (!import.meta.client) return

    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.value) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    onScopeDispose(() => window.removeEventListener('beforeunload', warn))
  }

  return {
    isDirty: computed(() => dirty.value),
    markDirty: () => { dirty.value = true },
    markSaved: () => { dirty.value = false },
    confirmLeave,
    guard,
  }
}
