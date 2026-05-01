<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
  import { ArrowLeft } from '@lucide/svelte'
</script>

<PageHeader title="Standardabsender und Anrede">
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
    'Anrede-Stil (Sie/Du) projektübergreifend',
    'Default-Signatur für Mailvorlagen',
    'Optionaler Reply-To',
    'Werbe-/Endtext für PDFs'
  ]}
/>
