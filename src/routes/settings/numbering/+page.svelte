<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
  import { ArrowLeft } from '@lucide/svelte'
</script>

<PageHeader title="Nummernkreise">
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
    'Format-Templates pro Belegtyp (RE, AN, KV, AB, MA, KU)',
    'Nächster Wert je Kreis manuell setzbar',
    'Reservierte Werte für Migrationen aus Kfz-Kaufmann'
  ]}
/>
