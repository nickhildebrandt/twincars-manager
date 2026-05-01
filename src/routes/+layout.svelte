<script lang="ts">
  import '../app.css'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import AppShell from '$lib/components/layout/AppShell.svelte'
  import ToastTray from '$lib/components/ui/ToastTray.svelte'
  import { getLayoutContext } from './layout.remote'

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
