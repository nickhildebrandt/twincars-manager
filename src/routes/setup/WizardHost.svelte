<script lang="ts">
  /**
   * Test-only host that wraps the wizard `+page.svelte` in a
   * `<svelte:boundary>`. The page uses `await` at the top of its
   * `<script>` (Svelte 5 experimental async), which only resolves
   * cleanly inside a parent boundary; SvelteKit's SSR provides one in
   * production, vitest + jsdom does not — so we add one here.
   *
   * Not imported by production code.
   */
  import Page from './+page.svelte'
</script>

<svelte:boundary>
  <Page />
  {#snippet pending()}
    <div data-testid="wizard-pending">loading</div>
  {/snippet}
</svelte:boundary>
