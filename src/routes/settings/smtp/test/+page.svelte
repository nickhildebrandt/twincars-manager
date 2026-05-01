<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
  import { ArrowLeft } from '@lucide/svelte'
</script>

<PageHeader title="Test-Mail senden">
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
    'Empfänger-Adresse eintragen',
    'Test-Versand über die hinterlegte SMTP-Konfiguration',
    'Erfolgs-/Fehler-Status in der Versand-Historie'
  ]}
/>
