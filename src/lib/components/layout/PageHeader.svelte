<script lang="ts">
  import type { Snippet } from 'svelte'
  import {
    pageHeader,
    type BackTarget,
    type PrimaryAction
  } from '$lib/stores/page-title.svelte'

  type Props = {
    title: string
    // Optional back navigation (URL or callback). Renders the back arrow before
    // the title in the app's top header bar.
    back?: BackTarget
    // Optional primary action (e.g. "Neuer Kunde") rendered top-right in the
    // header bar.
    primaryAction?: PrimaryAction
    // Subtitle is accepted for backwards compatibility but no longer rendered.
    subtitle?: string
    toolbar?: Snippet
  }
  const { title, back, primaryAction, toolbar }: Props = $props()

  $effect(() => {
    pageHeader.set({ title, back, primaryAction })
    return () => pageHeader.reset()
  })
</script>

{#if toolbar}
  <div class="mb-4">
    {@render toolbar()}
  </div>
{/if}
