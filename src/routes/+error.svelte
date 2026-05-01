<script lang="ts">
  /**
   * Root-level error page. Rendered by SvelteKit whenever a route throws
   * (top-level `await` rejects, server `error(status, ...)` is called, an
   * unhandled exception bubbles up). The page is intentionally minimal:
   *
   * - It only ever shows the curated message that came back from
   *   `handleError` / `handleValidationError` in `hooks.server.ts`, or
   *   from an explicit `error(status, 'german message')` in a remote
   *   function. No stack traces, no internal fields, no English fallback.
   * - Status-aware copy gives a non-technical user a useful hint
   *   (e.g. 404 vs 500).
   * - Two clear actions: go back, or jump to the dashboard.
   */
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { AlertTriangle, Home, ArrowLeft } from '@lucide/svelte'

  const status = $derived(page.status)
  const detail = $derived(page.error?.message?.trim() || '')

  const headline = $derived(
    status === 404
      ? 'Seite nicht gefunden'
      : status === 403
        ? 'Zugriff nicht erlaubt'
        : status === 400
          ? 'Ungültige Eingabe'
          : 'Es ist ein Fehler aufgetreten'
  )

  const subline = $derived(
    status === 404
      ? 'Die angeforderte Seite oder der Datensatz existiert nicht (mehr).'
      : status === 403
        ? 'Sie haben keine Berechtigung, diese Seite aufzurufen.'
        : status === 400
          ? 'Bitte prüfen Sie Ihre Eingaben und versuchen Sie es erneut.'
          : 'Das tut uns leid. Bitte versuchen Sie es in einem Moment erneut.'
  )

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      goto('/')
    }
  }
</script>

<div class="grid min-h-dvh place-items-center p-6">
  <div class="card border-base-300 bg-base-100 w-full max-w-md border">
    <div class="card-body items-center text-center">
      <div class="bg-error/10 text-error rounded-full p-3">
        <AlertTriangle size={32} />
      </div>
      <span class="badge badge-ghost mt-2 font-mono text-xs">
        Fehler {status}
      </span>
      <h1 class="card-title mt-1 text-xl">{headline}</h1>
      <p class="text-base-content/70 text-sm">{subline}</p>
      {#if detail}
        <div class="alert alert-error mt-4 text-left text-sm">
          <span>{detail}</span>
        </div>
      {/if}
      <div class="card-actions mt-6 justify-center gap-2">
        <button type="button" class="btn btn-ghost gap-2" onclick={goBack}>
          <ArrowLeft size={16} /> Zurück
        </button>
        <a class="btn btn-primary gap-2" href="/">
          <Home size={16} /> Zum Dashboard
        </a>
      </div>
    </div>
  </div>
</div>
