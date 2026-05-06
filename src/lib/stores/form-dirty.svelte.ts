/**
 * Globaler Dirty-State für Eingabemasken. Jedes Formular setzt
 * `dirty` beim ersten Input und löscht es auf save/cancel/leave.
 *
 * Die {@link AppShell} hookt einmal global:
 *   - SvelteKit `beforeNavigate` (Klick auf Sidebar / Header /
 *     interne Links) → fragt zurück per `confirm`.
 *   - `window.beforeunload` (Browser-Tab schließen, Reload) → der
 *     Browser zeigt seine native Warnung, wenn `dirty=true`.
 *
 * Verwendung in einer Form-Komponente:
 *
 *   import { formDirty } from '$lib/stores/form-dirty.svelte'
 *   $effect(() => {
 *     formDirty.set(true)
 *     return () => formDirty.clear()
 *   })  // wenn Eingaben kommen
 *
 *   const handleSave = async (...) => {
 *     formDirty.clear()
 *     await busy.run(...)
 *   }
 *
 * Pattern dokumentiert in CONTRIBUTING.md §11.
 */
let _dirty = $state(false)

export const formDirty = {
  get dirty(): boolean {
    return _dirty
  },
  set: (v: boolean): void => {
    _dirty = v
  },
  clear: (): void => {
    _dirty = false
  }
}
