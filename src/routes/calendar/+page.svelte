<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Kalender"
  subtitle="Termine, Urlaube, Krankheit, Betriebsschließungen, Feiertage."
/>
<ComingSoon
  features={[
    'Wochen-/Tages-/Monatsansicht',
    'Mitarbeiterfilter',
    'Konflikt-Warnung bei Terminen während Abwesenheiten'
  ]}
/>
