<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Buchhaltung / Ein- und Ausgaben"
  subtitle="Alle Ein- und Ausgaben mit Belegen."
/>
<ComingSoon
  features={[
    'Auto-Buchungen aus Rechnungen, Lohn und Fahrzeugverkauf',
    'Manuelle externe Buchungen',
    'Wiederkehrende Buchungen mit Intervallen',
    'Auswertungen und PDF/CSV-Export'
  ]}
/>
