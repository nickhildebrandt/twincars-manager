<script lang="ts">
  import type { Snippet } from 'svelte'

  type Props = {
    title: string
    subtitle?: string
    actions?: Snippet
    toolbar?: Snippet
  }
  const { title, subtitle, actions, toolbar }: Props = $props()
</script>

<div class="mb-4 flex flex-col gap-3 sm:mb-6">
  <div class="flex items-start justify-between gap-3">
    <div>
      <h2 class="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {#if subtitle}
        <p class="text-base-content/60 text-sm">{subtitle}</p>
      {/if}
    </div>
    {#if actions}
      <div class="flex shrink-0 items-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>
  {#if toolbar}
    <div>{@render toolbar()}</div>
  {/if}
</div>
