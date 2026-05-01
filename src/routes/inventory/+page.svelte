<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Fahrzeugbestand"
  subtitle="Gebrauchtwagenhandel mit Verkaufsschild als A4-PDF."
/>
<ComingSoon
  features={[
    'Foto-Galerie und Ausstattung',
    'Verkaufsschild als 1-Seiten-A4-PDF',
    'Verkauf erstellt automatisch eine Rechnung',
    'Auto-Buchung von Ankauf und Verkauf'
  ]}
/>
