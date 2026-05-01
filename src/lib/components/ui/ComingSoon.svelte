<script lang="ts">
  import { Sparkles } from '@lucide/svelte'
  import type { Snippet } from 'svelte'

  type Props = { features?: string[]; children?: Snippet }
  const { features = [], children }: Props = $props()
</script>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body items-center text-center">
    <div class="bg-primary/10 text-primary rounded-full p-3">
      <Sparkles size={28} />
    </div>
    <h3 class="card-title">In Vorbereitung</h3>
    <p class="text-base-content/70 max-w-md text-sm">
      Dieses Modul ist im Aufbau. Datenmodell und Routen sind bereits angelegt —
      die UI folgt schrittweise.
    </p>
    {#if features.length > 0}
      <ul
        class="text-base-content/80 mt-3 list-inside list-disc space-y-1 text-left text-sm"
      >
        {#each features as feature, i (i)}
          <li>{feature}</li>
        {/each}
      </ul>
    {/if}
    {#if children}<div class="mt-4">{@render children()}</div>{/if}
  </div>
</div>
