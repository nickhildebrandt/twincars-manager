<script lang="ts">
  import '../app.css'
  import { goto } from '$app/navigation'
  import AppShell from '$lib/components/layout/AppShell.svelte'
  import ToastTray from '$lib/components/ui/ToastTray.svelte'

  let { data, children } = $props()

  $effect(() => {
    if (
      typeof window !== 'undefined' &&
      !data.setupCompleted &&
      !data.isSetupRoute &&
      data.currentPath !== '/setup'
    ) {
      goto('/setup')
    }
  })
</script>

<svelte:head>
  <title>TwinCarsManager</title>
</svelte:head>

{#if data.isSetupRoute || !data.setupCompleted}
  <div class="min-h-dvh">
    {@render children?.()}
  </div>
{:else}
  <AppShell companyName={data.companyName}>
    {@render children?.()}
  </AppShell>
{/if}

<ToastTray />
