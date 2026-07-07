<script lang="ts">
  import { page } from '$app/state'
  import type { Snippet } from 'svelte'

  /**
   * Same-route param navigation (e.g. the Storno banner links between
   * an invoice and its Stornorechnung) reuses the mounted page
   * component — but the detail page freezes `page.params.id` at init
   * (top-level-await pattern), so the OLD document would keep
   * rendering under the NEW URL. Keying the subtree on the id forces
   * a clean remount per document.
   */
  let { children }: { children: Snippet } = $props()
</script>

{#key page.params.id}
  {@render children()}
{/key}
