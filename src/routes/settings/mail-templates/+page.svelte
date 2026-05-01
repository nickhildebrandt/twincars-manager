<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
  import { ArrowLeft } from '@lucide/svelte'
</script>

<PageHeader title="Mailvorlagen">
  {#snippet actions()}
    <button
      class="btn btn-ghost btn-sm gap-2"
      onclick={() => goto('/settings')}
    >
      <ArrowLeft size={16} /> Zurück
    </button>
  {/snippet}
</PageHeader>

<ComingSoon
  features={[
    'Betreff und Body je Vorlage editieren',
    'Live-Vorschau mit Beispieldaten',
    'Auf Standard zurücksetzen',
    'Versionierung (vorherige Variante wiederherstellen)',
    'Test-Mail mit aktueller Vorlage senden'
  ]}
/>
