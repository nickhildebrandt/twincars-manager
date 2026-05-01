<script lang="ts">
  import type { Snippet } from 'svelte'
  import { pageTitle } from '$lib/stores/page-title.svelte'

  type Props = {
    title: string
    subtitle?: string
    actions?: Snippet
    toolbar?: Snippet
  }
  const { title, subtitle, actions, toolbar }: Props = $props()

  $effect(() => {
    pageTitle.set(title)
    return () => pageTitle.reset()
  })
</script>

{#if subtitle || actions}
  <div
    class="mb-4 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-4"
  >
    <div>
      {#if subtitle}
        <p class="text-base-content/60 text-sm">{subtitle}</p>
      {/if}
    </div>
    {#if actions}
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>
{/if}
{#if toolbar}
  <div class="mb-4">
    {@render toolbar()}
  </div>
{/if}
