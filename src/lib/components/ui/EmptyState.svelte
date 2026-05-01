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

<div
  class="border-base-300 bg-base-100 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center"
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
