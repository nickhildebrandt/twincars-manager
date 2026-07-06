<script lang="ts">
  /**
   * Test-only host that wraps the async `+page.svelte` (top-level
   * `await` of preview + history) in a `<svelte:boundary>` so it can
   * resolve inside vitest + jsdom. Not imported by production code.
   */
  import Page from './+page.svelte'
</script>

<svelte:boundary>
  <Page />
  {#snippet pending()}
    <div data-testid="page-pending">loading</div>
  {/snippet}
</svelte:boundary>
