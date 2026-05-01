<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader title="Serienbriefe" subtitle="Anschreiben an Zielgruppen." />
<ComingSoon
  features={[
    'Vorlagen mit Platzhaltern',
    'Filter nach HU, Geburtsdatum, PLZ',
    'PDF und E-Mail'
  ]}
/>
