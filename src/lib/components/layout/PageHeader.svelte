<script lang="ts">
  import type { Snippet } from 'svelte'
  import { pageTitle } from '$lib/stores/page-title.svelte'

  type Props = {
    title: string
    // `subtitle` is intentionally accepted for backwards compatibility but
    // no longer rendered — the page title is shown in the app header bar.
    subtitle?: string
    actions?: Snippet
    toolbar?: Snippet
  }
  const { title, actions, toolbar }: Props = $props()

  $effect(() => {
    pageTitle.set(title)
    return () => pageTitle.reset()
  })
</script>

{#if actions}
  <div class="mb-4 flex items-center justify-end gap-2">
    {@render actions()}
  </div>
{/if}
{#if toolbar}
  <div class="mb-4">
    {@render toolbar()}
  </div>
{/if}
