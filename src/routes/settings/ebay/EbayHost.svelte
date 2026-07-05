<script lang="ts">
  /**
   * Test-only host that wraps the eBay settings `+page.svelte` in a
   * `<svelte:boundary>` — the page uses top-level `await` (Svelte 5
   * experimental async), which needs a parent boundary outside of
   * SvelteKit's SSR. Not imported by production code.
   */
  import Page from './+page.svelte'
</script>

<svelte:boundary>
  <Page />
  {#snippet pending()}
    <div data-testid="ebay-pending">loading</div>
  {/snippet}
</svelte:boundary>
