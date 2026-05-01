<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Controlling / Statistik"
  subtitle="Visuelle Auswertungen mit Chart.js."
/>
<ComingSoon
  features={[
    '7 KPI-Kacheln und 14 Pflicht-Charts',
    'Forecast mit What-if-Slider',
    'Drill-Down in Detailmodule',
    'PDF-Bericht'
  ]}
/>
