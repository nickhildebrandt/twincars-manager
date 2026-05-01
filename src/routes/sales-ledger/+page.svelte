<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Rechnungsausgangsbuch"
  subtitle="Auswertung aller Rechnungsausgänge."
/>
<ComingSoon
  features={[
    'Filter nach Zeitraum/Kunde/Zahlart',
    'CSV- und PDF-Export',
    'DATEV-kompatibler Export'
  ]}
/>
