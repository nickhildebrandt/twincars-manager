<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { dev } from '$app/environment'
  import { goto, beforeNavigate, afterNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import AppShell from '$lib/components/layout/AppShell.svelte'
  import ToastTray from '$lib/components/ui/ToastTray.svelte'
  import { getCurrentUserRemote, getLayoutContext } from './layout.remote'
  import { busy } from '$lib/stores/busy.svelte'

  const { children } = $props()

  /**
   * Top-level await on the layout remote query. With Svelte's experimental
   * async support and SvelteKit's remote-function dehydration, the rendered
   * HTML carries the resolved value and the client picks it up from the
   * dehydrated cache without re-fetching.
   */
  const data = await getLayoutContext()
  const currentUser = await getCurrentUserRemote()

  const isSetupRoute = $derived(page.url.pathname.startsWith('/setup'))
  const isLoginRoute = $derived(page.url.pathname === '/login')

  $effect(() => {
    if (data.setupCompleted || isSetupRoute) return
    if (typeof window === 'undefined') return
    goto('/setup')
  })

  /**
   * Wire SvelteKit navigation into the global busy state. Every page change
   * — including switching between detail records — flips the busy state.
   * The top progress bar shows immediately; the overlay only kicks in if
   * the navigation takes longer than 250 ms.
   */
  let endNavigation: (() => void) | null = null
  beforeNavigate(() => {
    endNavigation?.()
    endNavigation = busy.begin()
  })
  afterNavigate(() => {
    endNavigation?.()
    endNavigation = null
  })

  /**
   * Service-worker lifecycle (auto-registration is off, see
   * svelte.config.js): register the PWA worker in production builds
   * only. In dev, actively unregister anything that is still there —
   * vite's ephemeral module URLs make a stale dev-registered worker
   * throw "script evaluation" errors on the next visit, and this
   * heals every browser that ever picked one up on a localhost port.
   */
  onMount(() => {
    if (!('serviceWorker' in navigator)) return
    if (dev) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
      return
    }
    void navigator.serviceWorker.register('/service-worker.js')
  })
</script>

<svelte:head>
  <title>TwinCarsManager</title>
</svelte:head>

{#if isSetupRoute || !data.setupCompleted || isLoginRoute}
  <div class="min-h-dvh">
    {@render children?.()}
  </div>
{:else}
  <AppShell companyName={data.companyName} {currentUser}>
    {@render children?.()}
  </AppShell>
{/if}

<ToastTray />
