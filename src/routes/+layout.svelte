<script lang="ts">
  import '../app.css'
  import { goto, beforeNavigate, afterNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import AppShell from '$lib/components/layout/AppShell.svelte'
  import ToastTray from '$lib/components/ui/ToastTray.svelte'
  import { getLayoutContext } from './layout.remote'
  import { busy } from '$lib/stores/busy.svelte'

  const { children } = $props()

  /**
   * Top-level await on the layout remote query. With Svelte's experimental
   * async support and SvelteKit's remote-function dehydration, the rendered
   * HTML carries the resolved value and the client picks it up from the
   * dehydrated cache without re-fetching.
   */
  const data = await getLayoutContext()

  const isSetupRoute = $derived(page.url.pathname.startsWith('/setup'))

  $effect(() => {
    if (data.setupCompleted || isSetupRoute) return
    if (typeof window === 'undefined') return
    goto('/setup')
  })

  /**
   * Wire SvelteKit navigation into the global busy state. Every page change
   * — including switching between detail records — flips the overlay so
   * the user sees a consistent loading indication and cannot click around
   * mid-transition.
   */
  beforeNavigate(() => busy.begin())
  afterNavigate(() => busy.end())
</script>

<svelte:head>
  <title>TwinCarsManager</title>
</svelte:head>

{#if isSetupRoute || !data.setupCompleted}
  <div class="min-h-dvh">
    {@render children?.()}
  </div>
{:else}
  <AppShell companyName={data.companyName}>
    {@render children?.()}
  </AppShell>
{/if}

<ToastTray />
