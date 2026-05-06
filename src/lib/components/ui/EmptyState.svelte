<script lang="ts">
  import { Inbox } from '@lucide/svelte'
  import type { Component, Snippet } from 'svelte'

  type Props = {
    icon?: Component
    title: string
    description?: string
    action?: Snippet
  }

  const { icon, title, description, action }: Props = $props()
  const Icon = $derived(icon ?? Inbox)
</script>

<!--
  EmptyState is borderless on purpose — list pages already wrap it in a
  card (so the outer border is rendered once), and standalone uses sit
  on the page background where a plain centered block fits the flat
  design language better than a stacked second border.
-->
<div
  class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
>
  <div class="bg-base-200 text-base-content/50 rounded-full p-4">
    <Icon size={28} />
  </div>
  <h3 class="text-base font-semibold">{title}</h3>
  {#if description}
    <p class="text-base-content/60 max-w-md text-sm">{description}</p>
  {/if}
  {#if action}
    <div class="mt-2">{@render action()}</div>
  {/if}
</div>
