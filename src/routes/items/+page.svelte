<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Leistungen, Material und Artikel"
  subtitle="Stammdaten für Leistungen, Material und Artikel mit Lager."
/>
<ComingSoon
  features={[
    'Suche und Filter nach Kategorie',
    'Lagerbestand mit Mindest- und Maximalbestand',
    'Einkaufs- und Verkaufspreise'
  ]}
/>
